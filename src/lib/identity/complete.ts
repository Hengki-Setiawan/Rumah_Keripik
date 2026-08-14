import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatSessions, customerAddress } from '@/lib/schema';
import { verifyOtp, type OtpPurpose } from '@/lib/identity/otp';
import { linkChatSessionToCustomer } from '@/lib/chat-v3/customer-context';
import { resolveCustomerByPhone } from '@/lib/customer-resolver';
import { getOrCreateIdentityFlow, updateIdentityFlow } from '@/lib/identity/flow';

export async function completeOtpIdentity(input: {
  phone: string;
  code: string;
  chatSessionId: string;
  displayName?: string;
  purpose: OtpPurpose;
  address?: {
    text: string;
    note?: string;
    mapsLink?: string;
    lat?: string;
    lng?: string;
  } | null;
}): Promise<
  | { ok: true; customerId: string; isNew: boolean; phone: string }
  | { ok: false; error: string; reason?: string }
> {
  const result = await verifyOtp({ phone: input.phone, code: input.code, purpose: input.purpose });
  if (!result.ok) {
    const message =
      result.error === 'invalid_code' ? 'Kode OTP salah. Coba periksa lagi ya.' :
      result.error === 'expired' ? 'Kode OTP sudah kedaluwarsa. Minta kode baru ya.' :
      result.error === 'too_many_attempts' ? 'Terlalu banyak percobaan. Minta kode baru untuk melanjutkan.' :
      'Kode OTP tidak ditemukan. Minta kode baru ya.';
    return { ok: false, error: message, reason: result.error };
  }

  const [chatSession] = await db.select().from(chatSessions).where(eq(chatSessions.id, input.chatSessionId)).limit(1);
  if (!chatSession) return { ok: false, error: 'Sesi chat tidak ditemukan' };

  const flow = await getOrCreateIdentityFlow(input.chatSessionId);
  const name = input.displayName || flow?.displayName || 'Customer';
  const customer = await resolveCustomerByPhone(db, {
    name,
    phone: input.phone,
    source: 'web',
    notes: input.purpose === 'register' ? 'Terdaftar via verifikasi OTP chat' : null,
  });

  if (input.purpose === 'register' && input.address?.text) {
    await db.insert(customerAddress).values({
      id_customer: customer.idCustomer,
      label: 'Alamat utama',
      recipient_name: name,
      phone: input.phone,
      address_text: input.address.text,
      latitude: input.address.lat || null,
      longitude: input.address.lng || null,
      location_source: input.address.lat && input.address.lng ? 'gps' : 'manual',
      landmark: input.address.mapsLink || null,
      courier_note: input.address.note || null,
      is_default: 1,
      last_used_at: sql`(datetime('now', 'utc'))`,
    }).onConflictDoNothing();
  }

  await linkChatSessionToCustomer(input.chatSessionId, customer.idCustomer);
  await db.update(chatSessions).set({ updatedAt: sql`(datetime('now', 'utc'))` }).where(eq(chatSessions.id, input.chatSessionId));
  await updateIdentityFlow(input.chatSessionId, { step: 'complete', phoneNumber: input.phone, displayName: name, otpRequestId: null });

  return { ok: true, customerId: customer.idCustomer, isNew: customer.isNew, phone: customer.phone };
}