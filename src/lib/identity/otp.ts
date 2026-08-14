import { and, desc, eq, sql } from 'drizzle-orm';
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { db } from '@/lib/db';
import { customerProfile, otpRequests } from '@/lib/schema';
import { normalizePhoneNumber } from '@/lib/utils';
import { checkRateLimit } from '@/lib/rate-limit';

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_SEND_LIMIT = 3;
export const OTP_SEND_WINDOW_MS = 10 * 60 * 1000;
export const OTP_IP_LIMIT = 20;
export const OTP_IP_WINDOW_MS = 60 * 60 * 1000;
export const OTP_LOCKOUT_MS = 15 * 60 * 1000;

export type OtpPurpose = 'login' | 'register' | 'checkout_verification';

export type RequestOtpResult =
  | { ok: true; sent: true; phone: string; phoneMasked: string; phoneFound: boolean; displayName?: string | null; idCustomer?: string; expiresInSeconds: number; devModeOtp?: string }
  | { ok: true; sent: false; reason: 'phone_not_found' | 'already_registered' | 'cooldown' | 'rate_limited'; phone: string; phoneMasked: string; phoneFound: boolean; displayName?: string | null; idCustomer?: string }
  | { ok: false; error: string };

export type VerifyOtpResult =
  | { ok: true; phone: string; consumedAt: string }
  | { ok: false; error: 'invalid_code' | 'expired' | 'too_many_attempts' | 'not_found' };

export function normalizeAndValidatePhone(raw: string): { ok: true; phone: string } | { ok: false; error: string } {
  const cleaned = normalizePhoneNumber(raw);
  if (cleaned.length < 10 || cleaned.length > 15) return { ok: false, error: 'Format nomor WhatsApp tidak valid' };
  try {
    const parsed = parsePhoneNumberFromString(cleaned, 'ID');
    if (parsed && parsed.isValid()) return { ok: true, phone: parsed.number.replace('+', '') };
  } catch {
    // fallback ke normalizePhoneNumber bila libphonenumber gagal
  }
  return { ok: true, phone: cleaned };
}

export function hashOtpCode(code: string) {
  return createHash('sha256').update(code).digest('hex');
}

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function maskPhone(phone: string) {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length <= 4) return '****';
  return `•••• ${cleaned.slice(-4)}`;
}

export async function lookupCustomerByPhone(phone: string): Promise<{ found: boolean; displayName?: string | null; idCustomer?: string }> {
  const [row] = await db
    .select({ id_customer: customerProfile.id_customer, nama: customerProfile.nama })
    .from(customerProfile)
    .where(eq(customerProfile.phone, phone))
    .limit(1);
  if (!row) return { found: false };
  return { found: true, displayName: row.nama, idCustomer: row.id_customer };
}

export async function sendOtpViaFonnte(phone: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.FONNTE_TOKEN;
  if (!token) return { ok: false, error: 'Fonnte belum dikonfigurasi' };
  try {
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        target: phone,
        countryCode: '62',
        message: `Kode OTP Rumah Keripik Anda: *${code}*\nKode berlaku 5 menit. Jangan bagikan ke siapa pun.`,
        typing: 'true',
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, error: `Fonnte error ${response.status}` };
    // Fonnte sukses: { status: true, id: [..], detail: 'success! message in queue' }
    // Gagal terkirim: status 0 (num) atau id kosong.
    const id = data?.id;
    const status = data?.status;
    const hasId = Array.isArray(id) ? id.length > 0 : typeof id === 'string' && id.length > 0;
    if (status === true && hasId) return { ok: true };
    if (status === 0 || status === false || !hasId) return { ok: false, error: 'Fonnte mengantre tetapi belum terkirim' };
    return { ok: false, error: 'Fonnte gagal mengirim, coba lagi nanti' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? `Fonnte gagal: ${error.message}` : 'Fonnte gagal' };
  }
}

export async function requestOtp(input: {
  phone: string;
  purpose: OtpPurpose;
  ip?: string | null;
  displayName?: string | null;
}): Promise<RequestOtpResult> {
  const normalized = normalizeAndValidatePhone(input.phone);
  if (!normalized.ok) return { ok: false, error: normalized.error };
  const phone = normalized.phone;
  const phoneMasked = maskPhone(phone);

  const phoneCheck = await lookupCustomerByPhone(phone);
  if (input.purpose === 'login' && !phoneCheck.found) {
    return { ok: true, sent: false, reason: 'phone_not_found', phone, phoneMasked, phoneFound: false };
  }
  if (input.purpose === 'register' && phoneCheck.found) {
    return { ok: true, sent: false, reason: 'already_registered', phone, phoneMasked, phoneFound: true, displayName: phoneCheck.displayName, idCustomer: phoneCheck.idCustomer };
  }

  const rate = await checkRateLimit(`otp-send:${phone}`, OTP_SEND_LIMIT, OTP_SEND_WINDOW_MS);
  if (!rate.ok) return { ok: true, sent: false, reason: 'rate_limited', phone, phoneMasked, phoneFound: phoneCheck.found };
  if (input.ip) {
    const ipRate = await checkRateLimit(`otp-ip:${input.ip}`, OTP_IP_LIMIT, OTP_IP_WINDOW_MS);
    if (!ipRate.ok) return { ok: true, sent: false, reason: 'rate_limited', phone, phoneMasked, phoneFound: phoneCheck.found };
  }

  const [recent] = await db
    .select({ createdAt: otpRequests.createdAt, consumedAt: otpRequests.consumedAt })
    .from(otpRequests)
    .where(and(eq(otpRequests.phoneNumber, phone), eq(otpRequests.purpose, input.purpose)))
    .orderBy(desc(otpRequests.createdAt))
    .limit(1);
  if (recent && !recent.consumedAt) {
    const recentTime = Date.parse(recent.createdAt.replace(' ', 'T') + 'Z');
    if (Number.isFinite(recentTime) && Date.now() - recentTime < OTP_LOCKOUT_MS) {
      return { ok: true, sent: false, reason: 'cooldown', phone, phoneMasked, phoneFound: phoneCheck.found };
    }
  }

  const code = String(randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  const id = `OTP-${randomUUID().slice(0, 8)}`;

  try {
    await db.insert(otpRequests).values({
      id,
      phoneNumber: phone,
      codeHash: hashOtpCode(code),
      purpose: input.purpose,
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      expiresAt,
      ipAddress: input.ip ?? null,
      createdAt: sql`(datetime('now', 'utc'))`,
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? `Gagal menyimpan OTP: ${error.message}` : 'Gagal menyimpan OTP' };
  }

  const sendResult = await sendOtpViaFonnte(phone, code);
  if (!sendResult.ok) {
    await db.delete(otpRequests).where(eq(otpRequests.id, id)).catch(() => null);
    return { ok: false, error: sendResult.error ?? 'Gagal mengirim OTP' };
  }

  return { ok: true, sent: true, phone, phoneMasked, phoneFound: phoneCheck.found, displayName: phoneCheck.displayName, idCustomer: phoneCheck.idCustomer, expiresInSeconds: OTP_TTL_MS / 1000, ...(process.env.NODE_ENV !== 'production' ? { devModeOtp: code } : {}) };
}

export async function verifyOtp(input: { phone: string; code: string; purpose?: OtpPurpose }): Promise<VerifyOtpResult> {
  const normalized = normalizeAndValidatePhone(input.phone);
  if (!normalized.ok) return { ok: false, error: 'not_found' };
  const phone = normalized.phone;
  const code = input.code.trim();

  const [record] = await db
    .select()
    .from(otpRequests)
    .where(and(eq(otpRequests.phoneNumber, phone), ...(input.purpose ? [eq(otpRequests.purpose, input.purpose)] : [])))
    .orderBy(desc(otpRequests.createdAt))
    .limit(1);

  if (!record) return { ok: false, error: 'not_found' };
  if (record.consumedAt) return { ok: false, error: 'not_found' };
  if (record.attempts >= record.maxAttempts) return { ok: false, error: 'too_many_attempts' };

  const expiresAt = Date.parse(record.expiresAt.replace(' ', 'T') + 'Z');
  if (Number.isFinite(expiresAt) && Date.now() > expiresAt) {
    return { ok: false, error: 'expired' };
  }

  const match = safeEqual(record.codeHash, hashOtpCode(code));
  if (!match) {
    await db
      .update(otpRequests)
      .set({ attempts: record.attempts + 1 })
      .where(eq(otpRequests.id, record.id));
    return { ok: false, error: 'invalid_code' };
  }

  const consumedAt = new Date().toISOString();
  await db
    .update(otpRequests)
    .set({ consumedAt })
    .where(eq(otpRequests.id, record.id));

  return { ok: true, phone, consumedAt };
}