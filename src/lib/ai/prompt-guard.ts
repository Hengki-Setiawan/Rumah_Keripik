/**
 * Guard input chat: deteksi prompt injection & redaksi PII.
 *
 * Dijalankan SEBELUM pesan masuk ke model (di /api/chat dan orchestrator).
 * Prinsip: murah & deterministik (regex), tidak menunda chat, dan tidak pernah
 * menghentikan layanan — hanya melabeli pesan berisiko agar ditangani aman.
 */

export type GuardVerdict =
  | { status: 'safe'; sanitized: string }
  | { status: 'blocked'; reason: string };

const INJECTION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /abaikan\s+(semua\s+)?(instruksi|perintah|rules|aturan|prompt)/i, reason: 'Mencoba menimpa instruksi asisten' },
  { pattern: /lupakan\s+(semua\s+)?(instruksi|perintah|rules|aturan|prompt)/i, reason: 'Mencoba menimpa instruksi asisten' },
  { pattern: /ignore\s+(all\s+)?(previous|prior)\s+(instructions|prompts|rules)/i, reason: 'Mencoba menimpa instruksi asisten' },
  { pattern: /forget\s+(all\s+)?(instructions|rules|prompt)/i, reason: 'Mencoba menimpa instruksi asisten' },
  { pattern: /(you are|kamu (sekarang|adalah)) (now )?(a |an )?(free|unfiltered|unrestricted|jailbreak)/i, reason: 'Mencoba jailbreak asisten' },
  { pattern: /ignore system/i, reason: 'Mencoba menimpa instruksi sistem' },
  { pattern: /(disregard|override|tulis ulang)\s+(system\s+)?(prompt|instruksi)/i, reason: 'Mencoba menimpa instruksi sistem' },
  { pattern: /repeat\s+the\s+(above|word)/i, reason: 'Mencoba ekstraksi prompt tersembunyi' },
  { pattern: /tampilkan\s+(system\s+)?prompt/i, reason: 'Mencoba mengekstrak prompt sistem' },
  { pattern: /what\s+are\s+your\s+(instructions|prompts)/i, reason: 'Mencoba mengekstrak prompt sistem' },
  { pattern: /dalam\s+markdown/i, reason: 'Mencoba mengubah format keluaran model' },
];

// PII: nomor telepon (kecuali konteks verifikasi OTP sudah ditangani di identity flow —
// di sini hanya redaksi untuk mencegah PII terulang di prompt ke model secara berlebihan).
const PHONE_PATTERN = /(\+?62|0)[\s.-]?8\d{2}[\s.-]?\d{3,4}[\s.-]?\d{3,5}/g;

export function guardInput(message: string): GuardVerdict {
  const trimmed = message.trim();
  if (!trimmed) return { status: 'safe', sanitized: trimmed };

  const lower = trimmed.toLowerCase();

  // 1) Deteksi prompt injection (sebelum redaksi, agar pola mentah terlihat).
  for (const { pattern, reason } of INJECTION_PATTERNS) {
    if (pattern.test(lower)) {
      return { status: 'blocked', reason };
    }
  }

  // 2) Redaksi PII berulang/berlebihan (mis. menempel banyak nomor) — hindari bocor
  //    ke riwayat prompt. Nomor tunggal dibiarkan karena dipakai alur OTP/order.
  const phoneMatches = trimmed.match(PHONE_PATTERN) || [];
  if (phoneMatches.length > 2) {
    let redacted = trimmed;
    for (const m of phoneMatches) {
      redacted = redacted.replace(m, (match) => `${match.slice(0, 4)}•••${match.slice(-2)}`);
    }
    return { status: 'safe', sanitized: redacted };
  }

  return { status: 'safe', sanitized: trimmed };
}

export const BLOCKED_REPLY =
  'Maaf kak, aku tidak bisa memproses pesan itu. Kalau mau pesan keripik, bantu aku dengan pertanyaan yang jelas ya.';
