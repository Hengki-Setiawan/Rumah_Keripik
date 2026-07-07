import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { aiToolCalls, chatSessions, failedConversation } from '@/lib/schema';
import { generateIdAiToolCall } from '@/lib/id-generator';
import { getChatMessages } from '@/lib/chat-v3/messages';
import { AIChatResponseSchema } from '@/lib/chat-v3/schemas';
import { getCustomerContextForChat } from '@/lib/chat-v3/customer-context';
import { buildMemoryPrompt } from '@/lib/chat-v3/memory';
import { recommendProducts } from '@/lib/ai/tools/products';
import { getChatCart } from '@/lib/ai/tools/cart';
import { getActivePaymentMethods } from '@/lib/ai/tools/payment';
import { generateTextWithRouter } from '@/lib/ai/model-router';
import { ORDER_ASSISTANT_SYSTEM_PROMPT } from '@/lib/ai/prompts/order-assistant';
import { runChatTool } from '@/lib/ai/tool-registry';
import { logAiLearningEvent, logRecommendationEvent } from '@/lib/ai/learning-events';
import { searchKnowledgeBase, type KnowledgeChunk } from '@/lib/knowledge/retrieval';
import type { AIChatResponse, ChatComponent } from '@/lib/chat-v3/types';

export async function buildChatResponse(chatSessionId: string, message: string): Promise<AIChatResponse> {
  const deterministic = await buildDeterministicResponse(chatSessionId, message);
  const shouldTryModel = !deterministic || deterministic.confidence == null || deterministic.confidence < 0.9;
  if (!shouldTryModel) return deterministic;

  try {
    const [history, customerContext, cart] = await Promise.all([
      getChatMessages(chatSessionId, 10),
      getCustomerContextForChat(chatSessionId),
      getChatCart(chatSessionId),
    ]);
    const knowledgeChunks = await maybeSearchKnowledge(message);
    const memoryPrompt = buildMemoryPrompt(customerContext.memory);
    const knowledgePrompt = formatKnowledgePrompt(knowledgeChunks);
    const contextPrompt = [
      ORDER_ASSISTANT_SYSTEM_PROMPT,
      'Balas hanya JSON valid sesuai schema: {"reply","intent","components","nextAction","shouldCallTool","toolName","toolArgs","confidence"}. Jangan tulis markdown.',
      'Jika user bertanya FAQ/kebijakan/pembayaran/pengiriman dan knowledge base relevan tersedia, jawab singkat dari source itu. Jika tidak yakin, request handoff admin.',
      `Cart aktif: ${cart.itemCount} item, total ${cart.total}.`,
      customerContext.customer ? `Customer dikenal: ${customerContext.customer.name || customerContext.customer.id}, WA ${customerContext.customer.phoneMasked || '-'}.` : 'Customer belum identified.',
      customerContext.defaultAddress ? `Alamat default tersedia: ${customerContext.defaultAddress.addressSummary}.` : 'Alamat default belum tersedia.',
      memoryPrompt ? `Memory customer:\n${memoryPrompt}` : '',
      knowledgePrompt,
    ].filter(Boolean).join('\n\n');

    const result = await generateTextWithRouter({
      task: 'structured_chat_response',
      chatSessionId,
      systemPrompt: contextPrompt,
      messages: history.slice(-8).map((item) => ({ role: item.role === 'user' ? 'user' : item.role === 'assistant' ? 'assistant' : 'system', content: item.content })),
      maxTokens: 220,
      temperature: 0.15,
    });

    const parsedJson = parseJsonObject(result.text);
    if (parsedJson) {
      const parsed = AIChatResponseSchema.safeParse(parsedJson);
      if (parsed.success) {
        const response = parsed.data;
        await logAiLearningEvent({ eventType: 'chat_response', chatSessionId, intent: response.intent, outcome: response.confidence && response.confidence < 0.5 ? 'low_confidence' : 'answered', metadata: { provider: result.provider, model: result.model, knowledgeSourceIds: knowledgeChunks.map((chunk) => chunk.id) } });
        if (response.shouldCallTool && response.toolName) return await executeRequestedTool(chatSessionId, response, message);
        return response;
      }
      await logFailedConversation(chatSessionId, message, 'invalid_json', result.text, result.model);
    }
  } catch (error) {
    await logFailedConversation(chatSessionId, message, 'provider_error', error instanceof Error ? error.message : 'AI orchestrator error');
  }

  return deterministic || {
    reply: 'Aku bisa bantu pilih produk, cek keranjang, pembayaran, dan status pesanan kak.',
    intent: 'small_talk',
    components: defaultQuickReplies(),
    confidence: 0.55,
  };
}

async function executeRequestedTool(chatSessionId: string, response: AIChatResponse, originalMessage: string): Promise<AIChatResponse> {
  const started = Date.now();
  try {
    const output = await runChatTool(chatSessionId, response.toolName || '', response.toolArgs || {});
    await logToolCall(chatSessionId, response.toolName || '', response.toolArgs || {}, output, 'success', Date.now() - started);
    return await responseFromToolOutput(chatSessionId, response, output, originalMessage);
  } catch (error) {
    await logToolCall(chatSessionId, response.toolName || '', response.toolArgs || {}, { error: error instanceof Error ? error.message : 'Tool error' }, 'error', Date.now() - started);
    await logFailedConversation(chatSessionId, originalMessage, 'provider_error', error instanceof Error ? error.message : 'Tool error');
    return { reply: 'Aksi itu belum bisa aku proses. Sebentar ya, aku teruskan ke admin.', intent: 'handoff_to_admin', components: [{ type: 'admin_handoff_card', reason: 'Tool gagal diproses' }], confidence: 0.4 };
  }
}

async function responseFromToolOutput(chatSessionId: string, response: AIChatResponse, output: unknown, originalMessage: string): Promise<AIChatResponse> {
  const toolName = response.toolName;
  if (toolName === 'recommend_products' || toolName === 'recommendProducts' || toolName === 'search_products' || toolName === 'searchProducts') {
    const products = Array.isArray(output) ? output as Array<{ id: string }> : await recommendProducts(originalMessage);
    const productIds = products.map((item) => item.id);
    await logRecommendationEvent({ eventType: 'shown', chatSessionId, productIds, reason: 'tool_recommend_products', metadata: { originalMessage } });
    return { reply: response.reply || 'Siap kak, ini pilihan yang cocok.', intent: 'recommend_products', components: productComponents(productIds), nextAction: 'wait_product_selection', confidence: response.confidence ?? 0.85 };
  }
  if (toolName === 'get_cart' || toolName === 'getCart') {
    const cart = await getChatCart(chatSessionId);
    return { reply: cart.itemCount > 0 ? 'Ini ringkasan keranjang kak.' : 'Keranjang masih kosong kak.', intent: 'show_cart', components: cart.itemCount > 0 ? [{ type: 'cart_summary', cartId: cart.id }] : defaultQuickReplies(), confidence: 0.86 };
  }
  if (toolName === 'get_payment_methods' || toolName === 'getPaymentMethods') {
    const methods = await getActivePaymentMethods();
    return { reply: 'Ini metode pembayaran yang sedang aktif ya kak.', intent: 'show_payment', components: [{ type: 'payment_methods', methodIds: methods.map((method) => method.id) }], confidence: 0.88 };
  }
  if (toolName === 'search_knowledge_base') {
    const chunks = Array.isArray(output) ? output as KnowledgeChunk[] : [];
    if (chunks.length === 0) return { reply: 'Aku belum punya sumber pasti untuk itu. Sebentar ya, aku teruskan ke admin.', intent: 'handoff_to_admin', components: [{ type: 'admin_handoff_card', reason: 'Knowledge base belum punya jawaban relevan' }], confidence: 0.45 };
    return { reply: response.reply || summarizeKnowledgeChunks(chunks), intent: 'small_talk', components: defaultQuickReplies(), confidence: response.confidence ?? 0.82 };
  }
  return { ...response, shouldCallTool: false, toolName: undefined, toolArgs: undefined };
}

export async function buildDeterministicResponse(chatSessionId: string, message: string): Promise<AIChatResponse> {
  const lower = message.toLowerCase();
  const customerContext = await getCustomerContextForChat(chatSessionId);

  if (/^(ya|pakai|gunakan).*(data|alamat)|data ini|alamat ini/.test(lower) && customerContext.customer) {
    return {
      reply: customerContext.defaultAddress ? 'Siap kak, aku pakai data tersimpan. Sekarang pilih produk atau cek keranjang ya.' : 'Siap kak, data customer dipakai. Tinggal lengkapi alamat pengiriman ya.',
      intent: 'confirm_customer_data',
      components: customerContext.defaultAddress ? defaultQuickReplies() : [{ type: 'location_picker', mode: 'both' }],
      confidence: 0.92,
    };
  }

  if (/status|lacak|pesanan/.test(lower)) {
    if (customerContext.lastOrder) {
      return {
        reply: 'Ini status pesanan terakhir kak.',
        intent: 'track_order',
        components: [{ type: 'order_status_card', orderId: customerContext.lastOrder.id, orderCode: customerContext.lastOrder.code, status: customerContext.lastOrder.status, paymentStatus: customerContext.lastOrder.paymentStatus, deliveryStatus: customerContext.lastOrder.status, totalAmount: customerContext.lastOrder.totalAmount }],
        confidence: 0.92,
      };
    }
    return { reply: 'Bisa kak. Masukkan kode pesanan di halaman lacak, atau pilih tombol ini.', intent: 'track_order', components: [{ type: 'quick_replies', options: [{ id: 'lacak', label: 'Buka Lacak Pesanan', value: '/pesan/lacak', action: 'tool_action' }] }], confidence: 0.9 };
  }

  if (/bayar|pembayaran|qris|transfer|cod/.test(lower)) {
    const methods = await getActivePaymentMethods();
    return { reply: 'Ini metode pembayaran yang sedang aktif ya kak.', intent: 'show_payment', components: [{ type: 'payment_methods', methodIds: methods.map((method) => method.id) }], nextAction: 'select_payment_method', confidence: 0.9 };
  }

  if (/keranjang|cart|checkout|pesan sekarang|lanjut/.test(lower)) {
    const cart = await getChatCart(chatSessionId);
    return { reply: cart.itemCount > 0 ? 'Ini ringkasan keranjang kak.' : 'Keranjang masih kosong kak. Pilih produk dulu ya.', intent: 'show_cart', components: cart.itemCount > 0 ? [{ type: 'cart_summary', cartId: cart.id }] : defaultQuickReplies(), confidence: 0.86 };
  }

  if (/lokasi|alamat|kirim|pengiriman/.test(lower)) {
    if (customerContext.defaultAddress && !/ubah|baru|ganti/.test(lower)) {
      return { reply: 'Aku menemukan alamat tersimpan. Mau pakai alamat ini?', intent: 'request_location', components: [{ type: 'address_confirm', addressId: customerContext.defaultAddress.id, address: customerContext.defaultAddress, actions: ['use_saved_address', 'edit_address', 'send_new_location'] }], confidence: 0.9 };
    }
    return { reply: 'Biar pengiriman lebih tepat, kakak bisa isi alamat atau kirim titik lokasi.', intent: 'request_location', components: [{ type: 'location_picker', mode: 'both' }], confidence: 0.86 };
  }

  if (/admin|manusia|komplain|bantuan|marah|kecewa|refund|diskon/.test(lower)) {
    await db.update(chatSessions).set({ status: 'needs_admin', aiMode: 'paused', updatedAt: sql`(datetime('now', 'utc'))` }).where(eq(chatSessions.id, chatSessionId));
    return { reply: 'Sebentar ya kak, aku teruskan ke admin supaya dicek lebih pasti.', intent: 'handoff_to_admin', components: [{ type: 'admin_handoff_card', reason: 'Customer meminta bantuan admin' }], confidence: 0.94 };
  }

  if (/produk|keripik|kripik|rasa|pedas|original|keluarga|oleh|budget|hemat|rekomendasi|mau/.test(lower)) {
    const products = await recommendProducts(message, customerContext.memory);
    const productIds = products.map((product) => product.id);
    await logRecommendationEvent({ eventType: 'shown', chatSessionId, customerId: customerContext.customer?.id, productIds, reason: 'deterministic_recommendation', metadata: { message } });
    return { reply: 'Siap kak, ini pilihan yang cocok.', intent: 'recommend_products', components: productComponents(productIds), nextAction: 'wait_product_selection', confidence: 0.88 };
  }

  if (/halo|hai|pagi|siang|sore|malam/.test(lower) && customerContext.customer) {
    return { reply: `Halo kak${customerContext.customer.name ? ` ${customerContext.customer.name}` : ''}! Mau pakai data tersimpan untuk pesan lagi?`, intent: 'confirm_customer_data', components: [{ type: 'customer_confirm', customerId: customerContext.customer.id, maskedFields: true, customer: customerContext.customer, actions: ['use_saved_data', 'edit_data', 'send_new_location'] }, ...(customerContext.defaultAddress ? [{ type: 'address_confirm' as const, addressId: customerContext.defaultAddress.id, address: customerContext.defaultAddress, actions: ['use_saved_address', 'edit_address', 'send_new_location'] }] : [])], confidence: 0.9 };
  }

  return { reply: 'Aku bisa bantu pilih produk, cek keranjang, pembayaran, dan status pesanan kak.', intent: 'small_talk', components: defaultQuickReplies(), confidence: 0.58 };
}

async function maybeSearchKnowledge(message: string) {
  const lower = message.toLowerCase();
  if (!/(bayar|pembayaran|qris|transfer|cod|ongkir|kirim|pengiriman|alamat|faq|aturan|promo|jam|buka|tutup|komplain|refund|retur|stok|harga|halal|kadaluarsa|expired)/.test(lower)) return [];
  return searchKnowledgeBase({ query: message, topK: 3 }).catch(() => []);
}

function formatKnowledgePrompt(chunks: KnowledgeChunk[]) {
  if (chunks.length === 0) return '';
  return `Knowledge base relevan:\n${chunks.map((chunk, index) => `[${index + 1}] ${chunk.judul} (${chunk.kategori || 'Umum'}, score ${chunk.score.toFixed(2)}): ${chunk.teks}`).join('\n')}`;
}

function summarizeKnowledgeChunks(chunks: KnowledgeChunk[]) {
  const first = chunks[0];
  return first?.teks ? first.teks.slice(0, 220) : 'Ini informasi dari knowledge base toko kak.';
}

function productComponents(productIds: string[]): ChatComponent[] {
  return [
    { type: 'product_cards', productIds: productIds.slice(0, 4), reason: 'Rekomendasi dari katalog aktif', actions: ['add_to_cart', 'view_detail'] },
    { type: 'quick_replies', options: [{ id: 'lihat-cart', label: 'Lihat Keranjang', value: 'lihat keranjang', action: 'send_message' }] },
  ];
}

function defaultQuickReplies(): ChatComponent[] {
  return [{ type: 'quick_replies', options: [
    { id: 'rekomendasi', label: 'Rekomendasi Produk', value: 'rekomendasi produk', action: 'send_message' },
    { id: 'keranjang', label: 'Lihat Keranjang', value: 'lihat keranjang', action: 'send_message' },
    { id: 'bayar', label: 'Cara Bayar', value: 'cara bayar', action: 'send_message' },
  ] }];
}

function parseJsonObject(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }
}

async function logToolCall(chatSessionId: string, toolName: string, input: unknown, output: unknown, status: 'success' | 'error', latencyMs: number) {
  try {
    await db.insert(aiToolCalls).values({
      id: generateIdAiToolCall(),
      chatSessionId,
      toolName,
      inputJson: JSON.stringify(input),
      outputJson: JSON.stringify(output).slice(0, 4000),
      status,
      latencyMs,
    });
  } catch {
    // Tool logging must not break chat.
  }
}

async function logFailedConversation(chatSessionId: string, userMessage: string, reason: 'low_confidence' | 'invalid_json' | 'no_product_found' | 'provider_error' | 'ambiguous_address' | 'payment_issue' | 'unknown', rawAiOutput?: string, modelUsed?: string) {
  try {
    await db.insert(failedConversation).values({
      channel: 'web',
      id_session: chatSessionId,
      user_message: userMessage.slice(0, 1000),
      current_state: 'chat_v3',
      reason,
      raw_ai_output: rawAiOutput?.slice(0, 2000),
      model_used: modelUsed,
    });
  } catch {
    // Feedback logging must not break chat.
  }
}
