import type { AIChatResponse } from '@/lib/chat-v3/types';
import { getCustomerContextForChat } from '@/lib/chat-v3/customer-context';
import { getOrCreateIdentityFlow, updateIdentityFlow, type IdentityPurpose } from '@/lib/identity/flow';
import { requestOtp, type OtpPurpose } from '@/lib/identity/otp';
import { completeOtpIdentity } from '@/lib/identity/complete';
import { normalizePhoneNumber } from '@/lib/utils';

const OTP_PATTERN = /^\s*\d{6}\s*$/;

function extractPhone(message: string): string | null {
  const match = message.replace(/[^\d]/g, '');
  if (match.length < 9 || match.length > 15) return null;
  const normalized = normalizePhoneNumber(match);
  return /^62\d{8,13}$/.test(normalized) ? normalized : null;
}

function extractName(message: string): string | null {
  const trimmed = message.trim();
  if (trimmed.length < 2 || trimmed.length > 80) return null;
  const words = trimmed.split(/\s+/);
  if (words.length > 4) return null;
  if (/[0-9@]/.test(trimmed)) return null;
  return trimmed;
}

export async function buildIdentityFlowResponse(chatSessionId: string, message: string): Promise<AIChatResponse | null> {
  const context = await getCustomerContextForChat(chatSessionId);
  if (context.customer) return null;

  const flow = await getOrCreateIdentityFlow(chatSessionId);
  if (!flow) return null;
  if (flow.step === 'complete' || flow.step === 'cancelled') return null;

  const lower = message.toLowerCase().trim();

  const priorOrderReply = (text: string, options: { id: string; label: string; value: string }[]) =>
    ({ reply: text, intent: 'identity_verification' as const, components: [{ type: 'quick_replies' as const, options: options.map((o) => ({ ...o, action: 'send_message' as const })) }], confidence: 1.0 });

  switch (flow.step) {
    case 'ask_prior_order': {
      if (/(sudah|pernah|iya|ya\b)/.test(lower) && !/(belum|enggak|tidak)/.test(lower)) {
        await updateIdentityFlow(chatSessionId, { purpose: 'login', step: 'ask_phone_login' });
        return { reply: 'Siap kak! Masukkan nomor WhatsApp yang dulu dipakai untuk pesan, ya.', intent: 'identity_verification', confidence: 1.0 };
      }
      if (/(belum|baru|pertama kali|pertama)/.test(lower)) {
        await updateIdentityFlow(chatSessionId, { purpose: 'register', step: 'ask_name' });
        return { reply: 'Tentu kak! Senang kenalan. Boleh tahu nama panggilan kakak?', intent: 'identity_verification', confidence: 1.0 };
      }
      return priorOrderReply('Sebelum lanjut checkout — apakah kakak sudah pernah memesan di Rumah Keripik sebelumnya?', [
        { id: 'idp-pernah', label: '✅ Sudah pernah', value: 'Sudah pernah' },
        { id: 'idp-baru', label: '🆕 Belum pernah', value: 'Belum pernah' },
      ]);
    }

    case 'ask_phone_login': {
      const phone = extractPhone(message);
      if (!phone) {
        return { reply: 'Hmm, aku belum dapat nomor WhatsApp-nya. Bisa kirim nomor aktif kakak, ya? (contoh: 081234567890)', intent: 'identity_verification', confidence: 1.0 };
      }
      const result = await requestOtp({ phone, purpose: 'login' });
      if (!result.ok) return { reply: result.error, intent: 'identity_verification', confidence: 1.0 };

      if (!result.sent && result.reason === 'phone_not_found') {
        await updateIdentityFlow(chatSessionId, { step: 'ask_phone_mismatch', phoneNumber: phone });
        return priorOrderReply(`Hmm, nomor ${result.phoneMasked} ternyata belum terdaftar di sistem kami. Mungkin ada salah ketik? Atau kakak mau buat akun baru?`, [
          { id: 'idp-koreksi', label: '✏️ Koreksi nomor', value: 'Koreksi nomor' },
          { id: 'idp-buat-baru', label: '🆕 Buat akun baru', value: 'Buat akun baru' },
        ]);
      }
      if (!result.sent) {
        const tip = result.reason === 'rate_limited' ? 'Terlalu sering minta OTP. Tunggu sebentar, ya.' : 'Masih ada OTP aktif. Tunggu 15 menit sebelum minta lagi, ya.';
        return { reply: tip, intent: 'identity_verification', confidence: 1.0 };
      }

      await updateIdentityFlow(chatSessionId, { step: 'otp_pending', phoneNumber: phone });
      return {
        reply: `Kode OTP sudah dikirim ke WhatsApp ${result.phoneMasked}. Ketik 6 digit kodenya di chat ya.`,
        intent: 'identity_verification',
        components: [{ type: 'phone_otp', purpose: 'login', phone, phoneMasked: result.phoneMasked, phoneFound: true, otpSent: true, expiresInSeconds: result.expiresInSeconds, ...(result.devModeOtp ? { devModeOtp: result.devModeOtp } : {}) }],
        confidence: 1.0,
      };
    }

    case 'ask_phone_mismatch': {
      if (/(koreksi|salah|betul|nomor|ganti)/.test(lower)) {
        await updateIdentityFlow(chatSessionId, { step: 'ask_phone_login' });
        return { reply: 'Baik kak, silakan kirim nomor WhatsApp yang benar.', intent: 'identity_verification', confidence: 1.0 };
      }
      if (/(buat|baru|daftar|akun baru|mau buat)/.test(lower)) {
        await updateIdentityFlow(chatSessionId, { purpose: 'register', step: 'ask_name' });
        return { reply: 'Siap kak, kita buat akun baru. Boleh tahu nama panggilan kakak?', intent: 'identity_verification', confidence: 1.0 };
      }
      return priorOrderReply('Mau dikoreksi nomornya, atau buat akun baru?', [
        { id: 'idp-koreksi2', label: '✏️ Koreksi nomor', value: 'Koreksi nomor' },
        { id: 'idp-buat-baru2', label: '🆕 Buat akun baru', value: 'Buat akun baru' },
      ]);
    }

    case 'ask_name': {
      const name = extractName(message);
      if (!name) return { reply: 'Boleh tulis nama panggilan kakak aja ya (tanpa angka)?', intent: 'identity_verification', confidence: 1.0 };
      await updateIdentityFlow(chatSessionId, { displayName: name, step: 'ask_address' });
      return { reply: `Senang berkenalan, ${name}! 🎉 Sekarang alamat pengiriman kakak di mana? Bisa kirim titik lokasi atau tulis alamatnya.`, intent: 'identity_verification', components: [{ type: 'location_picker', mode: 'both' }], confidence: 1.0 };
    }

    case 'ask_address': {
      const address = message.trim();
      if (address.length < 8) return { reply: 'Alamatnya masih terlalu singkat kak. Bisa tulis lebih detail, atau kirim titik lokasi ya.', intent: 'identity_verification', confidence: 1.0 };
      const mapsLinkMatch = message.match(/https?:\/\/maps\.app\.goo\.gl\/\S+/i);
      const mapsLink = mapsLinkMatch ? mapsLinkMatch[0] : null;
      await updateIdentityFlow(chatSessionId, { addressText: address, mapsLink, step: 'ask_phone_register' });
      return { reply: 'Alamat dicatat. Terakhir, minta nomor WhatsApp aktif kakak untuk konfirmasi order ya.', intent: 'identity_verification', confidence: 1.0 };
    }

    case 'ask_phone_register': {
      const phone = extractPhone(message);
      if (!phone) {
        return { reply: 'Hmm, aku belum dapat nomor WhatsApp-nya. Bisa kirim nomor aktif kakak, ya? (contoh: 081234567890)', intent: 'identity_verification', confidence: 1.0 };
      }
      const result = await requestOtp({ phone, purpose: 'register' });
      if (!result.ok) return { reply: result.error, intent: 'identity_verification', confidence: 1.0 };

      if (!result.sent && result.reason === 'already_registered') {
        await updateIdentityFlow(chatSessionId, { step: 'ask_use_existing', phoneNumber: phone });
        return priorOrderReply(`Eh, nomor ${result.phoneMasked} ternyata sudah pernah dipakai pesan sebelumnya. Mau lanjut pakai akun lama?`, [
          { id: 'idp-akun-lama', label: '🔑 Pakai akun lama', value: 'Ya, pakai akun lama' },
          { id: 'idp-tetap-baru', label: '🆕 Tetap buat baru', value: 'Tidak, buat baru' },
        ]);
      }
      if (!result.sent) {
        const tip = result.reason === 'rate_limited' ? 'Terlalu sering minta OTP. Tunggu sebentar, ya.' : 'Masih ada OTP aktif. Tunggu 15 menit sebelum minta lagi, ya.';
        return { reply: tip, intent: 'identity_verification', confidence: 1.0 };
      }

      await updateIdentityFlow(chatSessionId, { step: 'otp_pending', phoneNumber: phone });
      return {
        reply: `Kode OTP sudah dikirim ke WhatsApp ${result.phoneMasked}. Ketik 6 digit kodenya di chat ya.`,
        intent: 'identity_verification',
        components: [{ type: 'phone_otp', purpose: 'register', phone, phoneMasked: result.phoneMasked, phoneFound: false, otpSent: true, expiresInSeconds: result.expiresInSeconds, ...(result.devModeOtp ? { devModeOtp: result.devModeOtp } : {}) }],
        confidence: 1.0,
      };
    }

    case 'ask_use_existing': {
      const phone = flow.phoneNumber;
      if (!phone) {
        await updateIdentityFlow(chatSessionId, { step: 'ask_phone_register' });
        return { reply: 'Baik, ulangi nomor WhatsApp kakak ya.', intent: 'identity_verification', confidence: 1.0 };
      }
      const useExisting = /(ya|pakai|akun lama|lanjut)/.test(lower);
      const purpose: OtpPurpose = useExisting ? 'login' : 'register';
      const result = await requestOtp({ phone, purpose });
      if (!result.ok) return { reply: result.error, intent: 'identity_verification', confidence: 1.0 };
      if (!result.sent) {
        const tip = result.reason === 'rate_limited' ? 'Terlalu sering minta OTP. Tunggu sebentar, ya.' : 'Masih ada OTP aktif. Tunggu sebentar, ya.';
        return { reply: tip, intent: 'identity_verification', confidence: 1.0 };
      }
      await updateIdentityFlow(chatSessionId, { step: 'otp_pending', purpose: purpose as IdentityPurpose });
      return {
        reply: `Oke kak, kode OTP sudah dikirim ke WhatsApp ${result.phoneMasked}. Ketik 6 digit kodenya ya.`,
        intent: 'identity_verification',
        components: [{ type: 'phone_otp', purpose, phone, phoneMasked: result.phoneMasked, phoneFound: true, otpSent: true, expiresInSeconds: result.expiresInSeconds, ...(result.devModeOtp ? { devModeOtp: result.devModeOtp } : {}) }],
        confidence: 1.0,
      };
    }

    case 'otp_pending': {
      const phone = flow.phoneNumber;
      if (!phone) {
        await updateIdentityFlow(chatSessionId, { step: 'ask_phone_login' });
        return { reply: 'Maaf, sesi OTP belum terhubung nomor. Masukkan ulang nomor WhatsApp kakak ya.', intent: 'identity_verification', confidence: 1.0 };
      }
      if (/(kirim ulang|resend|ulang)/.test(lower) && !OTP_PATTERN.test(lower)) {
        const purpose = (flow.purpose || 'checkout_verification') as OtpPurpose;
        const result = await requestOtp({ phone, purpose });
        if (!result.ok) return { reply: result.error, intent: 'identity_verification', confidence: 1.0 };
        if (!result.sent) {
          const tip = result.reason === 'rate_limited' ? 'Terlalu sering minta OTP. Tunggu 10 menit ya.' : 'Masih ada OTP aktif. Tunggu 15 menit sebelum minta lagi, ya.';
          return { reply: tip, intent: 'identity_verification', confidence: 1.0 };
        }
        return {
          reply: `Kode OTP baru sudah dikirim ke WhatsApp ${result.phoneMasked}. Ketik 6 digit kodenya ya.`,
          intent: 'identity_verification',
          components: [{ type: 'phone_otp', purpose, phone, phoneMasked: result.phoneMasked, phoneFound: result.phoneFound, otpSent: true, expiresInSeconds: result.expiresInSeconds, ...(result.devModeOtp ? { devModeOtp: result.devModeOtp } : {}) }],
          confidence: 1.0,
        };
      }
      if (!OTP_PATTERN.test(lower)) {
        return { reply: 'Tulis kode OTP-nya sebagai 6 digit angka ya kak.', intent: 'identity_verification', confidence: 1.0 };
      }
      const purpose = (flow.purpose || 'checkout_verification') as OtpPurpose;
      const result = await completeOtpIdentity({
        phone,
        code: lower,
        chatSessionId,
        displayName: flow.displayName || undefined,
        purpose,
        address: flow.addressText ? { text: flow.addressText, mapsLink: flow.mapsLink || undefined, lat: flow.addressLat || undefined, lng: flow.addressLng || undefined } : null,
      });
      if (!result.ok) return { reply: result.error, intent: 'identity_verification', confidence: 1.0 };

      return {
        reply: result.isNew
          ? `Berhasil terdaftar kak! 🎉 Data kakak sudah aman untuk order berikutnya. Lanjut ke pembayaran ya.`
          : `Berhasil dikonfirmasi kak! 🔑 Data tersimpan sudah dipakai. Lanjut ke pembayaran ya.`,
        intent: 'confirm_customer_data',
        confidence: 1.0,
      };
    }

    default:
      return null;
  }
}