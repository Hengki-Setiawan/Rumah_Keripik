import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatSessions } from '@/lib/schema';
import { getChatCart } from '@/lib/ai/tools/cart';
import type { AIChatResponse } from '@/lib/chat-v3/types';

/**
 * Rolling conversation context summary (per chat session).
 *
 * Tujuan: mempertahankan keputusan penting percakapan PANJANG yang biasanya
 * terbuang karena hanya 6 pesan terakhir yang dikirim ke model (orchestrator).
 * Alih-alih menyimpan semua pesan, kita ekstrak fakta kunci (produk/rasa/qty,
 * metode bayar, alamat, aksi order/keranjang) menjadi ringkasan berjalan yang
 * di-merge idempotently dan di-inject ke prompt model sebagai "Ringkasan
 * percakapan".
 *
 * Disimpan di chatSessions.contextSummary (JSON array, di-cap 15 entri).
 */

export type ContextSummaryEntry = {
  t: string; // jenis fakta
  v: string; // nilai/narasi
  ts?: number; // timestamp agar bisa dipangkas
};

const MAX_ENTRIES = 15;

function now(): number {
  return Date.now();
}

/**
 * Ekstrak fakta keputusan dari satu giliran percakapan (pesan user + respons AI).
 * Berisi pola regex ringan, TIDAK bergantung pada model — deterministik & murah.
 */
export function extractTurnFacts(message: string, response: AIChatResponse): ContextSummaryEntry[] {
  const entries: ContextSummaryEntry[] = [];
  const lower = message.toLowerCase().trim();

  const push = (t: string, v: string) => entries.push({ t, v, ts: now() });

  // Produk/rasa/qty yang dipilih user
  const flavor = lower.includes('pedas') || /balado|cabe|spicy/.test(lower)
    ? 'pedas'
    : /(original|non pedas|ga pedas|nggak pedas|keju|jagung|asin|gurih|bawang)/.test(lower)
      ? 'non-pedas'
      : null;

  const qtyMatch = lower.match(/(?:^|\s)(\d{1,3})(?:\s*(?:pcs?|pack|paket|bungkus|item|rasa|varian|dus|karton))?/);
  const hasOrderIntent = /pesan|beli|order|tambah|mau/.test(lower) || response.intent === 'add_to_cart' || response.intent === 'confirm_order';

  if (hasOrderIntent) {
    const parts: string[] = [];
    if (flavor) parts.push(`rasa ${flavor}`);
    if (qtyMatch) parts.push(`qty ${qtyMatch[1]}`);
    if (parts.length > 0) push('order', `user pilih ${parts.join(', ')}`);
  }

  // Metode pembayaran
  if (/cod|bayar di tempat/.test(lower)) push('payment', 'pembayaran COD');
  else if (/qris/.test(lower)) push('payment', 'pembayaran QRIS');
  else if (/transfer|bank/.test(lower)) push('payment', 'pembayaran transfer/bank');

  // Aksi alamat / data penerima
  if (/alamat|kirim|pengiriman|lokasi/.test(lower)) push('address', 'mengatur alamat pengiriman');
  if (response.intent === 'confirm_customer_data') push('identity', 'data customer/alamat dikonfirmasi');

  // Order / checkout
  if (response.intent === 'confirm_order') push('checkout', 'user menuju konfirmasi pesanan');
  if (response.intent === 'track_order') push('status', 'user cek status pesanan');
  if (response.intent === 'handoff_to_admin') push('handoff', 'diteruskan ke admin');
  if (/hapus|batalkan|cancel/.test(lower)) push('cancel', 'user membatalkan/menghapus');

  return entries;
}

/**
 * Baca ringkasan konteks session saat ini (JSON array).
 */
async function readSummary(chatSessionId: string): Promise<ContextSummaryEntry[]> {
  const [row] = await db
    .select({ contextSummary: chatSessions.contextSummary })
    .from(chatSessions)
    .where(eq(chatSessions.id, chatSessionId))
    .limit(1);
  if (!row?.contextSummary) return [];
  try {
    const parsed = JSON.parse(row.contextSummary);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Merge fakta baru ke ringkasan berjalan, dedupe berdasarkan (t, v), cap MAX_ENTRIES.
 * Diutamakan entri terbaru (LIFO) — yang paling relevan untuk konteks berjalan.
 */
function mergeSummary(existing: ContextSummaryEntry[], incoming: ContextSummaryEntry[]): ContextSummaryEntry[] {
  if (incoming.length === 0) return existing;
  const seen = new Set<string>();
  const merged: ContextSummaryEntry[] = [];
  for (const entry of [...incoming, ...existing]) {
    const key = `${entry.t}|${entry.v}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
    if (merged.length >= MAX_ENTRIES) break;
  }
  return merged;
}

/**
 * Simpan ringkasan berjalan untuk session (panggil setelah setiap giliran chat).
 * Aman (try/catch di dalam) — gagal menyimpan ringkasan tidak boleh mematahkan chat.
 */
export async function updateContextSummary(chatSessionId: string, message: string, response: AIChatResponse): Promise<void> {
  try {
    const incoming = extractTurnFacts(message, response);

    // Sertakan snapshot keranjang agar model tahu isi keranjang saat ini tanpa
    // harus mengulang seluruh riwayat produk.
    let cartLine: string | null = null;
    try {
      const cart = await getChatCart(chatSessionId);
      if (cart.itemCount > 0) {
        const items = cart.items.map((i) => `${i.quantity}x ${i.productName}${i.variantName ? ` (${i.variantName})` : ''}`).join(', ');
        cartLine = `${cart.itemCount} bungkus: ${items}`;
      }
    } catch {
      cartLine = null;
    }
    if (cartLine) incoming.unshift({ t: 'cart', v: cartLine, ts: now() });

    const existing = await readSummary(chatSessionId);
    const merged = mergeSummary(existing, incoming);

    await db
      .update(chatSessions)
      .set({
        contextSummary: merged.length > 0 ? JSON.stringify(merged) : null,
        updatedAt: sql`(datetime('now', 'utc'))`,
      })
      .where(eq(chatSessions.id, chatSessionId));
  } catch (error) {
    console.error('[ContextSummary] Gagal update ringkasan konteks:', error);
  }
}

/**
 * Format ringkasan menjadi blok prompt untuk model.
 * Dimasukkan ke system prompt sebagai "Ringkasan percakapan sebelumnya".
 */
export async function getContextSummaryPrompt(chatSessionId: string): Promise<string> {
  try {
    const entries = await readSummary(chatSessionId);
    if (entries.length === 0) return '';
    const lines = entries
      .filter((e) => e.v && e.v.trim())
      .map((e) => `- ${e.v}`)
      .join('\n');
    return lines ? `Ringkasan percakapan sebelumnya:\n${lines}` : '';
  } catch {
    return '';
  }
}
