import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatSessions } from '@/lib/schema';

function normalizeMessage(message: string) {
  return message
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim();
}

export function deriveChatSessionTitle(message: string, intent?: string | null) {
  const normalized = normalizeMessage(message);
  const lower = normalized.toLowerCase();

  if (intent === 'track_order' || /status|lacak|cek pesanan|pesanan saya/.test(lower)) return 'Pesanan Saya';
  if (intent === 'show_payment' || /bayar|pembayaran|qris|transfer|cod/.test(lower)) return 'Pembayaran Pesanan';
  if (intent === 'show_cart' || /keranjang|checkout|lanjut pesanan/.test(lower)) return 'Keranjang Belanja';
  if (intent === 'request_location' || /alamat|lokasi|pengiriman|kirim/.test(lower)) return 'Alamat Pengiriman';
  if (intent === 'handoff_to_admin' || /admin|komplain|refund|bantuan/.test(lower)) return 'Butuh Bantuan Admin';
  if (/pedas/.test(lower)) return 'Pesan Keripik Pedas';
  if (/tidak pedas|ga pedas|nggak pedas|anak/.test(lower)) return 'Pesan Keripik Non Pedas';
  if (/keluarga|paket/.test(lower)) return 'Paket Keluarga';
  if (/warung|grosir|stok toko|reseller/.test(lower)) return 'Pesanan Untuk Warung';
  if (/oleh|oleh-oleh/.test(lower)) return 'Pesanan Oleh-Oleh';
  if (intent === 'recommend_products' || /produk|keripik|kripik|rasa|rekomendasi/.test(lower)) return 'Pilih Produk Keripik';

  if (!normalized) return 'Pesanan Baru';
  if (normalized.length <= 32) return normalized;
  return `${normalized.slice(0, 29).trimEnd()}...`;
}

export async function updateChatSessionTitle(chatSessionId: string, message: string, intent?: string | null) {
  const title = deriveChatSessionTitle(message, intent);
  await db
    .update(chatSessions)
    .set({
      title,
      updatedAt: sql`(datetime('now', 'utc'))`,
    })
    .where(eq(chatSessions.id, chatSessionId));
}
