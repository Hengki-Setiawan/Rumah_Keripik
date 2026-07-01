/**
 * Chatbot Router v2.0 — Super AI Edition
 * Priority: Active Order Flow → Auto Reply Rules → Intent Detection → RAG + LLM
 *
 * Alur:
 *   1. Load context_sesi dari pelanggan_chatbot
 *   2. Jika sedang dalam flow order aktif (step != IDLE/QA_MODE)
 *      → route ke Order State Machine
 *   3. Jika tidak, deteksi intent dari pesan baru:
 *      a. Auto Reply Rules (keyword match)
 *      b. Order Tracking / Product Recommendations
 *      c. Intent: START_ORDER, SHOW_CATALOG, CANCEL_ORDER
 *      d. Fallback: RAG + LLM
 */

import { db } from '@/lib/db';
import { pelangganChatbot, botAutoReply, chatLog, aiKnowledgeBase, transaksi, detailTransaksi, produk } from '@/lib/schema';
import { eq, like, or, and, inArray, sql, desc } from 'drizzle-orm';
import { callGroqLLM } from '@/lib/groq';
import { getSystemPrompt, getRAGSystemPrompt } from '@/lib/chatbot-prompts';
import { processOrderState, handleGreeting, getMenuText } from './order-state-machine';
import { extractCoordsFromText } from './location-parser';
import { processLocationMessage } from './location-flow';
import type { OrderContext } from './order-types';

export interface RouterResult {
  response: string;
  source: 'rule' | 'order_flow' | 'groq' | 'gemini' | 'not_found';
  modelUsed?: string;
  tokensUsed?: number;
}

/**
 * Entry point — proses pesan masuk dari WhatsApp
 * Support: text, image, location
 */
export async function processIncomingMessage(
  no_wa: string,
  message: string,
  isImage?: boolean,
  imageMessageId?: string,
  locationData?: { lat: number; lng: number; address?: string },
): Promise<RouterResult> {
  const lowerMessage = message.trim().toLowerCase();

  await ensurePelangganExists(no_wa);

  // Skip jika sedang di-handle admin
  const pelanggan = await db
    .select()
    .from(pelangganChatbot)
    .where(eq(pelangganChatbot.no_wa_pelanggan, no_wa))
    .limit(1)
    .then((r) => r[0]);

  if (pelanggan?.status_handle === 'Manual_Admin') {
    return { response: '', source: 'not_found' };
  }

  // Load context sesi dari DB
  let ctx: OrderContext = { step: 'IDLE' };
  try {
    ctx = pelanggan?.context_sesi
      ? JSON.parse(pelanggan.context_sesi)
      : { step: 'IDLE' };
  } catch {
    ctx = { step: 'IDLE' };
  }

  // ─── ORDER FLOW AKTIF? ──────────────────────────────────────────
  const isOrderFlowActive = ctx.step && ctx.step !== 'IDLE' && ctx.step !== 'QA_MODE';

  if (isOrderFlowActive) {
    // Jika gambar masuk saat DRAFT_TERSIMPAN → proses bukti bayar
    if (isImage && ctx.step === 'DRAFT_TERSIMPAN' && imageMessageId) {
      const { processPaymentProof } = await import('./media-handler');
      const result = await processPaymentProof(no_wa, imageMessageId, ctx);
      await updateContext(no_wa, result.newContext);
      await logChat(no_wa, `[Gambar: bukti bayar]`, result.response, 'rule');
      return { response: result.response, source: 'order_flow' };
    }

    // Jika lokasi masuk saat FORM_ALAMAT → proses lokasi
    const parsedMapsLocation = locationData ? null : await extractCoordsFromText(message);
    const incomingLocation = locationData
      ? { ...locationData, source: 'wa_native' as const }
      : parsedMapsLocation;

    if (incomingLocation && ctx.step === 'FORM_ALAMAT') {
      const result = await processLocationMessage(no_wa, incomingLocation, ctx);
      await updateContext(no_wa, result.newContext);
      await logChat(no_wa, `[Lokasi: ${incomingLocation.lat},${incomingLocation.lng}]`, result.response, 'rule');
      return { response: result.response, source: 'order_flow' };
    }

    // Delegasikan ke Order State Machine
    const result = await processOrderState(no_wa, message, ctx, pelanggan);

    // Simpan context baru
    if (result.newContext) {
      await updateContext(no_wa, result.newContext);
    }

    // Log ke chat_log
    await logChat(no_wa, message, result.response, 'rule');

    return { response: result.response, source: 'order_flow' };
  }

  // ─── TIDAK ADA ORDER AKTIF — DETEKSI INTENT ──────────────────────

  // Step 1 — Auto Reply Rules
  const standaloneLocation = locationData
    ? { ...locationData, source: 'wa_native' as const }
    : await extractCoordsFromText(message);

  if (standaloneLocation) {
    const result = await processLocationMessage(no_wa, standaloneLocation, ctx);
    await updateContext(no_wa, result.newContext);
    await logChat(no_wa, `[Lokasi: ${standaloneLocation.lat},${standaloneLocation.lng}]`, result.response, 'rule');
    await touchPelanggan(no_wa);
    return { response: result.response, source: 'rule' };
  }

  const ruleMatch = await matchAutoReply(lowerMessage);
  if (ruleMatch) {
    await logChat(no_wa, message, ruleMatch, 'rule');
    await touchPelanggan(no_wa);
    return { response: ruleMatch, source: 'rule' };
  }

  // Step 2 — Order Tracking
  const orderResult = await checkOrderTracking(no_wa, lowerMessage);
  if (orderResult) {
    await logChat(no_wa, message, orderResult, 'rule');
    await touchPelanggan(no_wa);
    return { response: orderResult, source: 'rule' };
  }

  // Step 3 — Product Recommendations
  const recomResult = await checkProductRecommendation(lowerMessage);
  if (recomResult) {
    await logChat(no_wa, message, recomResult, 'rule');
    await touchPelanggan(no_wa);
    return { response: recomResult, source: 'rule' };
  }

  // Step 4 — Intent detection: order / katalog / batal
  const orderKeywords = ['pesan', 'beli', 'order', 'mau beli', 'mau pesan', 'saya mau'];
  const catalogKeywords = ['katalog', 'menu', 'daftar produk', 'produk', 'list'];
  const cancelKeywords = ['batal', 'cancel', 'reset'];

  if (cancelKeywords.some((k) => lowerMessage.includes(k))) {
    await resetContext(no_wa);
    const resp = 'Sesi dibatalkan. Ada yang bisa kami bantu lagi? Ketik *pesan* untuk mulai pesan baru.';
    await logChat(no_wa, message, resp, 'rule');
    return { response: resp, source: 'rule' };
  }

  if (catalogKeywords.some((k) => lowerMessage.includes(k))) {
    const menuText = await getMenuText();
    await logChat(no_wa, message, menuText, 'rule');
    await touchPelanggan(no_wa);
    return { response: menuText, source: 'rule' };
  }

  if (orderKeywords.some((k) => lowerMessage.includes(k)) || isGreeting(lowerMessage)) {
    try {
      const result = await handleGreeting(no_wa, message, pelanggan);
      if (result.newContext) {
        await updateContext(no_wa, result.newContext);
      }
      await logChat(no_wa, message, result.response, 'rule');
      return { response: result.response, source: 'order_flow' };
    } catch (err) {
      console.error('[Router] handleGreeting error:', err);
    }
  }

  // Step 5 — RAG dari knowledge base
  const knowledgeContext = await searchKnowledgeBase(lowerMessage);

  const messages = [{ role: 'user' as const, content: message }];
  const systemPrompt = knowledgeContext
    ? getRAGSystemPrompt(knowledgeContext)
    : getSystemPrompt();

  // Step 6 — LLM Chain
  try {
    const llmResult = await callGroqLLM(messages, 512, 0.7, systemPrompt);
    const source = llmResult.provider === 'gemini' ? 'gemini' : 'groq';

    await logChat(no_wa, message, llmResult.text, source, llmResult.provider, llmResult.tokensUsed);
    await touchPelanggan(no_wa);

    return {
      response: llmResult.text,
      source,
      modelUsed: llmResult.provider,
      tokensUsed: llmResult.tokensUsed,
    };
  } catch (error) {
    console.error('LLM chain failed:', error);
    const fallback = 'Maaf, saya sedang mengalami gangguan teknis. Silakan coba lagi nanti atau hubungi admin.';
    await logChat(no_wa, message, fallback, 'not_found');
    await touchPelanggan(no_wa);
    return { response: fallback, source: 'not_found' };
  }
}

/**
 * Cari keyword yang cocok di auto_reply_rules (semua aktif)
 */
async function matchAutoReply(lowerMessage: string): Promise<string | null> {
  try {
    const rules = await db
      .select()
      .from(botAutoReply)
      .where(eq(botAutoReply.is_active, 1))
      .orderBy(desc(botAutoReply.created_at));

    for (const rule of rules) {
      if (lowerMessage.includes(rule.keyword.toLowerCase())) {
        return rule.response;
      }
    }
    return null;
  } catch (error) {
    console.error('matchAutoReply error:', error);
    return null;
  }
}

/**
 * Cek apakah pesan menanyakan status pesanan.
 * Cari berdasarkan kode pesanan atau ID transaksi.
 */
async function checkOrderTracking(no_wa: string, lowerMessage: string): Promise<string | null> {
  const orderKeywords = ['pesanan', 'order', 'status', 'cek', 'dimana', 'sudah dikirim', 'tracking', 'resi', 'pengiriman', 'kode pesan'];
  const hasOrderIntent = orderKeywords.some((k) => lowerMessage.includes(k));

  if (!hasOrderIntent) return null;

  try {
    // Cari transaksi terbaru milik pelanggan ini
    const tx = await db
      .select({
        id_transaksi: transaksi.id_transaksi,
        kode_pesanan: transaksi.kode_pesanan,
        total_bayar: transaksi.total_bayar,
        status_pembayaran: transaksi.status_pembayaran,
        tipe_penjualan: transaksi.tipe_penjualan,
        waktu_simpan: transaksi.waktu_simpan,
        catatan: transaksi.catatan,
      })
      .from(transaksi)
      .where(eq(transaksi.no_wa_pelanggan, no_wa))
      .orderBy(desc(transaksi.waktu_simpan))
      .limit(1);

    if (tx.length === 0) return null;

    const items = await db
      .select({
        nama_produk: produk.nama_produk,
        qty_terjual: detailTransaksi.qty_terjual,
        subtotal: detailTransaksi.subtotal,
      })
      .from(detailTransaksi)
      .innerJoin(produk, eq(detailTransaksi.id_produk, produk.id_produk))
      .where(eq(detailTransaksi.id_transaksi, tx[0].id_transaksi));

    const date = new Date(tx[0].waktu_simpan + 'Z');
    const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const itemList = items.map((i) => `- ${i.nama_produk} x${i.qty_terjual}`).join('\n');
    const total = `Rp ${tx[0].total_bayar.toLocaleString('id-ID')}`;
    const statusIcon =
      tx[0].status_pembayaran === 'Lunas' ? '✅ Lunas' :
      tx[0].status_pembayaran === 'Menunggu_Verifikasi' ? '⏳ Menunggu verifikasi admin' :
      tx[0].status_pembayaran === 'Menunggu_Bayar' ? '💳 Menunggu pembayaran' :
      tx[0].status_pembayaran === 'Piutang' ? '⏳ Belum dibayar / piutang' :
      tx[0].status_pembayaran === 'Dibatalkan' ? '❌ Dibatalkan' :
      tx[0].status_pembayaran;

    return `Status Pesanan Terakhirmu:\n\nKode: ${tx[0].kode_pesanan || tx[0].id_transaksi}\nTanggal: ${dateStr}\nPembayaran: ${statusIcon}\nTotal: ${total}\n\nPesanan:\n${itemList}\n\n${tx[0].catatan ? `Catatan: ${tx[0].catatan}\n\n` : ''}Untuk info lebih lanjut, hubungi admin ya.`;
  } catch (error) {
    console.error('checkOrderTracking error:', error);
    return null;
  }
}

/**
 * Cek apakah pesan menanyakan rekomendasi produk.
 * Call: "rekomendasi produk", "produk apa yang bagus", "best seller"
 */
async function checkProductRecommendation(lowerMessage: string): Promise<string | null> {
  const recomKeywords = ['rekomendasi', 'produk', 'best seller', 'terlaris', 'bagus', 'sarank', 'pilihan', 'kripik', 'singkong', 'pisang', 'tempe'];
  const hasRecomIntent = recomKeywords.some((k) => lowerMessage.includes(k));
  if (!hasRecomIntent) return null;

  try {
    // Get top 5 best-selling products
    const ranking = await db
      .select({
        id_produk: detailTransaksi.id_produk,
        qty_total: sql<number>`SUM(${detailTransaksi.qty_terjual})`,
      })
      .from(detailTransaksi)
      .groupBy(detailTransaksi.id_produk)
      .orderBy(desc(sql`SUM(${detailTransaksi.qty_terjual})`))
      .limit(5);

    if (ranking.length === 0) return null;

    const produkList = await db
      .select()
      .from(produk)
      .where(inArray(produk.id_produk, ranking.map(r => r.id_produk)));

    const lines = ranking.map((r, i) => {
      const p = produkList.find(pr => pr.id_produk === r.id_produk);
      if (!p) return null;
      return `${i + 1}. ${p.nama_produk} — Rp ${p.harga_jual.toLocaleString('id-ID')} (${r.qty_total} terjual)`;
    }).filter(Boolean);

    if (lines.length === 0) return null;

    return `Berikut rekomendasi produk terlaris kami:\n\n${lines.join('\n')}\n\nKetik nama produk untuk info lebih lanjut atau ketik "catalog" untuk lihat semua produk.`;
  } catch (error) {
    console.error('checkProductRecommendation error:', error);
    return null;
  }
}

/**
 * Cari knowledge base — prefer vector search, fallback ke text search
 */
async function searchKnowledgeBase(lowerMessage: string): Promise<string | null> {
  try {
    let results: { judul: string; potongan_teks: string; kategori: string | null }[] = [];

    const keywords = lowerMessage.split(/\s+/).filter((k) => k.length > 2);
    if (keywords.length > 0) {
      const conditions = keywords.map((k) =>
        or(
          like(aiKnowledgeBase.judul, `%${k}%`),
          like(aiKnowledgeBase.potongan_teks, `%${k}%`)
        )
      );

      const textResults = await db
        .select()
        .from(aiKnowledgeBase)
        .where(and(or(...conditions), eq(aiKnowledgeBase.is_active, 1)))
        .limit(3);

      results = textResults.map((kb) => ({
        judul: kb.judul,
        potongan_teks: kb.potongan_teks,
        kategori: kb.kategori,
      }));
    }

    // Try vector search only when cheap keyword search finds nothing.
    try {
      if (results.length === 0) {
        const { generateQueryEmbedding } = await import('@/lib/gemini');
        const { embedding } = await generateQueryEmbedding(lowerMessage);
        const vectorStr = `[${embedding.join(',')}]`;

        const client = (await import('@libsql/client')).createClient({
          url: process.env.TURSO_DATABASE_URL!,
          authToken: process.env.TURSO_AUTH_TOKEN!,
        });

        const result = await client.execute({
          sql: `SELECT id, judul, potongan_teks, kategori, vector_distance_cos(vector_embedding, vector(?)) AS distance FROM ai_knowledge_base WHERE is_active = 1 AND vector_embedding IS NOT NULL ORDER BY distance LIMIT 3`,
          args: [vectorStr],
        });

        results = result.rows
          .filter((row: any) => (row.distance as number) < 0.45)
          .map((row: any) => ({
            judul: row.judul as string,
            potongan_teks: row.potongan_teks as string,
            kategori: row.kategori as string | null,
          }));
      }
    } catch (vecError) {
      console.warn('Vector search failed, falling back to text search:', vecError);
    }

    if (results.length === 0) return null;

    return results
      .map((kb) => `[${kb.kategori || 'Info'}] ${kb.judul}\n${kb.potongan_teks}`)
      .join('\n\n---\n\n');
  } catch (error) {
    console.warn('searchKnowledgeBase error:', error);
    return null;
  }
}

/**
 * Get atau create pelanggan
 */
async function ensurePelangganExists(no_wa: string) {
  try {
    const existing = await db
      .select()
      .from(pelangganChatbot)
      .where(eq(pelangganChatbot.no_wa_pelanggan, no_wa))
      .limit(1);

    if (existing.length === 0) {
      const channel = no_wa.startsWith('tg_') ? 'telegram' : 'wa';
      await db.insert(pelangganChatbot).values({
        no_wa_pelanggan: no_wa,
        status_handle: 'AI_Bot',
        context_sesi: '{}',
        channel,
      });
    }
  } catch (error) {
    console.error('ensurePelangganExists error:', error);
  }
}

/**
 * Update terakhir_aktif timestamp
 */
async function touchPelanggan(no_wa: string) {
  try {
    await db
      .update(pelangganChatbot)
      .set({ terakhir_aktif: sql`(datetime('now', 'utc'))` })
      .where(eq(pelangganChatbot.no_wa_pelanggan, no_wa));
  } catch (error) {
    console.error('touchPelanggan error:', error);
  }
}

/**
 * Log interaksi ke chat_log
 */
async function logChat(
  no_wa: string,
  userMessage: string,
  botResponse: string,
  sumber: 'rule' | 'groq' | 'gemini' | 'not_found' | 'order_flow',
  modelUsed?: string,
  tokensUsed?: number
) {
  try {
    const channel = no_wa.startsWith('tg_') ? 'telegram' : 'wa';
    const s = sumber === 'order_flow' ? 'rule' : sumber;
    await db.insert(chatLog).values({
      no_wa_pelanggan: no_wa,
      channel,
      user_message: userMessage,
      bot_response: botResponse,
      sumber: s,
      model_used: modelUsed || null,
      tokens_used: tokensUsed ?? 0,
    });
  } catch (error) {
    console.error('logChat error:', error);
  }
}

/**
 * Update context_sesi pelanggan di database
 */
async function updateContext(no_wa: string, ctx: OrderContext) {
  try {
    ctx.last_updated = new Date().toISOString();
    await db
      .update(pelangganChatbot)
      .set({ context_sesi: JSON.stringify(ctx) })
      .where(eq(pelangganChatbot.no_wa_pelanggan, no_wa));
  } catch (error) {
    console.error('updateContext error:', error);
  }
}

/**
 * Reset context_sesi ke IDLE
 */
async function resetContext(no_wa: string) {
  try {
    await db
      .update(pelangganChatbot)
      .set({ context_sesi: JSON.stringify({ step: 'IDLE' }) })
      .where(eq(pelangganChatbot.no_wa_pelanggan, no_wa));
  } catch (error) {
    console.error('resetContext error:', error);
  }
}

/**
 * Deteksi apakah pesan adalah sapaan
 */
function isGreeting(lowerMessage: string): boolean {
  const greetings = ['halo', 'hai', 'hi', 'hey', 'siang', 'pagi', 'sore', 'malam', 'assalamualaikum', 'assalamu\'alaikum', 'test'];
  return greetings.some((g) => lowerMessage.includes(g)) || lowerMessage.length < 5;
}
