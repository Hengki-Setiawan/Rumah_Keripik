import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { aiToolCalls, chatSessions, failedConversation } from '@/lib/schema';
import { generateIdAiToolCall } from '@/lib/id-generator';
import { getChatMessages } from '@/lib/chat-v3/messages';
import { AIChatResponseSchema } from '@/lib/chat-v3/schemas';
import { getCustomerContextForChat } from '@/lib/chat-v3/customer-context';
import { buildMemoryPrompt } from '@/lib/chat-v3/memory';
import { getChatV3Stage } from '@/lib/chat-v3/stage';
import type { ChatV3Stage } from '@/lib/chat-v3/stage';
import { recommendProducts } from '@/lib/ai/tools/products';
import { addToChatCart, getChatCart } from '@/lib/ai/tools/cart';
import { getActivePaymentMethods } from '@/lib/ai/tools/payment';
import { generateTextWithRouter } from '@/lib/ai/model-router';
import { ORDER_ASSISTANT_SYSTEM_PROMPT } from '@/lib/ai/prompts/order-assistant';
import { runChatTool } from '@/lib/ai/tool-registry';
import { logAiLearningEvent, logRecommendationEvent } from '@/lib/ai/learning-events';
import { searchKnowledgeBase, type KnowledgeChunk } from '@/lib/knowledge/retrieval';
import type { AIChatResponse, ChatComponent } from '@/lib/chat-v3/types';
import { getAgentLoopConfig, shouldUseAgentLoop } from '@/lib/ai/feature-flags';
import { runAgentLoop } from '@/lib/ai/agent-loop';
import { semanticCacheLookup, semanticCacheStore } from '@/lib/ai/semantic-cache-integration';

export async function buildChatResponse(chatSessionId: string, message: string): Promise<AIChatResponse> {
  const deterministic = await buildDeterministicResponse(chatSessionId, message);
  const shouldTryModel = !deterministic || deterministic.confidence == null || deterministic.confidence < 0.9;
  if (!shouldTryModel) return deterministic;

  const cacheHit = await semanticCacheLookup(message, 'faq_answer');
  if (cacheHit.hit && cacheHit.response) {
    try {
      const parsed = JSON.parse(cacheHit.response);
      const validated = AIChatResponseSchema.safeParse(parsed);
      if (validated.success) return validated.data;
    } catch {}
  }

  const agentLoopConfig = await getAgentLoopConfig();
  const useAgentLoop = shouldUseAgentLoop(agentLoopConfig, chatSessionId) && isComplexMessage(message);

  if (useAgentLoop) {
    try {
      const agentResult = await runAgentLoop({
        chatSessionId,
        userMessage: message,
        maxIterations: agentLoopConfig.maxIterations,
      });
      return {
        reply: agentResult.reply,
        intent: agentResult.intent,
        components: agentResult.components,
        confidence: 0.85,
      };
    } catch (loopError) {
      console.error('[AgentLoop] Agent loop error, falling back to standard AI:', loopError);
    }
  }

  try {
    const [history, customerContext, cart] = await Promise.all([
      getChatMessages(chatSessionId, 8),
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
      messages: history.map((item) => ({ role: item.role === 'user' ? 'user' : item.role === 'assistant' ? 'assistant' : 'system', content: item.content })),
      maxTokens: 220,
      temperature: 0.15,
    });

    const parsedJson = parseJsonObject(result.text);
    if (parsedJson) {
      const parsed = AIChatResponseSchema.safeParse(parsedJson);
      if (parsed.success) {
        const response = parsed.data;
        await semanticCacheStore(message, JSON.stringify(response), response.intent);
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

const PRODUCT_AND_CART_STAGES: ChatV3Stage[] = ['idle', 'product_discovery', 'cart_building'];
const CHECKOUT_STAGES: ChatV3Stage[] = ['customer_data_required', 'address_required', 'payment_selection'];
const ORDER_STAGES: ChatV3Stage[] = ['waiting_payment', 'payment_review', 'processing', 'shipping', 'completed', 'cancelled'];

export async function buildDeterministicResponse(chatSessionId: string, message: string): Promise<AIChatResponse> {
  const lower = message.toLowerCase().trim();
  const [customerContext, stage] = await Promise.all([
    getCustomerContextForChat(chatSessionId),
    getChatV3Stage(chatSessionId),
  ]);

  const complexOrder = parseComplexOrderIntent(lower);

  // ── UNIVERSAL: fire at ANY stage ──

  if (/admin|manusia|komplain|bantuan|marah|kecewa|refund|diskon/.test(lower)) {
    await db.update(chatSessions).set({ status: 'needs_admin', aiMode: 'paused', updatedAt: sql`(datetime('now', 'utc'))` }).where(eq(chatSessions.id, chatSessionId));
    return { reply: 'Sebentar ya kak, aku teruskan ke admin supaya dicek lebih pasti.', intent: 'handoff_to_admin', components: [{ type: 'admin_handoff_card', reason: 'Customer meminta bantuan admin' }], confidence: 0.94 };
  }

  if (/status|lacak|cek pesanan|pesanan saya/.test(lower)) {
    if (customerContext.lastOrder) {
      return { reply: 'Ini status pesanan terakhir kak.', intent: 'track_order', components: [{ type: 'order_status_card', orderId: customerContext.lastOrder.id, orderCode: customerContext.lastOrder.code, status: customerContext.lastOrder.status, paymentStatus: customerContext.lastOrder.paymentStatus, deliveryStatus: customerContext.lastOrder.status, totalAmount: customerContext.lastOrder.totalAmount }], confidence: 0.92 };
    }
    return { reply: 'Bisa kak. Buka halaman Pesanan Saya untuk melihat order yang tersimpan di browser ini.', intent: 'track_order', components: [{ type: 'quick_replies', options: [{ id: 'pesanan-saya', label: 'Buka Pesanan Saya', value: '/pesan/saya', action: 'tool_action' }] }], confidence: 0.9 };
  }

  if (/\b([3-9]\d|\d{3,})\s*(bungkus|pcs|pack|paket)/.test(lower) || (extractRequestedQuantity(lower) >= 30 && /\b(50|60|70|80|90|100)\b/.test(lower))) {
    const qtyMatch = lower.match(/\b(\d+)\b/);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 50;
    if (qty > 30) {
      return { reply: `Maksimal pemesanan via chat adalah 30 bungkus per transaksi kak. Untuk jumlah banyak (${qty} bungkus), silakan hubungi admin atau daftar reseller ya.`, intent: 'recommend_products', components: [{ type: 'admin_handoff_card', reason: 'Pemesanan di atas batas 30 bungkus' }], confidence: 0.95 };
    }
  }

  if (/stok (habis|kosong|0)|produk (habis|kosong)|tidak (ada|tersedia)/.test(lower)) {
    return { reply: 'Kalau produk yang kakak cari sedang habis, kakak bisa daftar tunggu biar dikabarin kalau stok udah ada lagi. Atau mau lihat produk lain yang tersedia?', intent: 'recommend_products', components: defaultQuickReplies(), confidence: 0.88 };
  }

  // ── PRODUK & CART STAGES ──

  if (PRODUCT_AND_CART_STAGES.includes(stage)) {
    if (/^(saya\s+)?(pernah\s+pesan|masuk|login|pelanggan\s+lama|ya\s+pernah|ya,\s+pernah)/.test(lower) && !customerContext.customer) {
      return { reply: 'Silakan masuk lewat menu Akun atau buka halaman Pesanan Saya ya kak.', intent: 'small_talk', components: [{ type: 'quick_replies', options: [{ id: 'go-pesanan-saya', label: '🔑 Pesanan Saya', value: '/login', action: 'tool_action' }] }], confidence: 1.0 };
    }

    if (complexOrder.wantsReOrder && customerContext.lastOrder) {
      return { reply: 'Siap kak, aku buatkan pesanan yang sama dengan order sebelumnya ya.', intent: 'confirm_order', components: [{ type: 'order_status_card', orderId: customerContext.lastOrder.id, orderCode: customerContext.lastOrder.code, status: customerContext.lastOrder.status, paymentStatus: customerContext.lastOrder.paymentStatus, deliveryStatus: customerContext.lastOrder.status, totalAmount: customerContext.lastOrder.totalAmount }], nextAction: 'reorder', confidence: 0.92 };
    }

    if (complexOrder.wantsReduceCart) {
      const cart = await getChatCart(chatSessionId);
      return { reply: cart.itemCount > 0 ? 'Siap kak, item di keranjang mau dikurangi. Silakan pilih yang mau dihapus di bawah.' : 'Keranjang masih kosong kak, tidak ada yang bisa dikurangi.', intent: 'update_cart', components: cart.itemCount > 0 ? [{ type: 'cart_summary', cartId: cart.id }] : defaultQuickReplies(), confidence: 0.9 };
    }

    if (complexOrder.wantsAddMore) {
      const products = await recommendProducts('rekomendasi produk', customerContext.memory);
      return { reply: 'Mau tambah produk lagi? Silakan pilih di bawah kak.', intent: 'add_to_cart', components: productComponents(products.map((p) => p.id)), nextAction: 'wait_product_selection', confidence: 0.9 };
    }

    if (complexOrder.needsProofUploadHelp) {
      return { reply: customerContext.lastOrder ? 'Pembayaran manual sudah dimatikan kak. Kalau order terakhir masih belum lunas, buka status pesanan untuk lanjutkan checkout online lagi ya.' : 'Pembayaran sekarang langsung lewat checkout online kak. Setelah order dibuat, tinggal lanjut bayar dari tautan yang muncul.', intent: 'show_payment', components: [
        ...(customerContext.lastOrder ? [{ type: 'order_status_card' as const, orderId: customerContext.lastOrder.id, orderCode: customerContext.lastOrder.code, status: customerContext.lastOrder.status, paymentStatus: customerContext.lastOrder.paymentStatus, deliveryStatus: customerContext.lastOrder.status, totalAmount: customerContext.lastOrder.totalAmount }] : []),
        { type: 'quick_replies', options: [{ id: 'proof-track', label: 'Buka Pesanan Saya', value: '/pesan/saya', action: 'tool_action' }, { id: 'proof-payment', label: 'Cara bayar', value: 'cara bayar', action: 'send_message' }] },
      ], confidence: 0.96 };
    }

    if (complexOrder.shouldPrepareOrder && complexOrder.items) {
      const recommendations = await recommendProducts(message, customerContext.memory);
      const addedProducts: string[] = [];
      for (const parsedItem of complexOrder.items) {
        const matchedProduct = findMatchedProduct(recommendations, parsedItem.flavorHint);
        if (matchedProduct) {
          const variantId = selectVariantIdForFlavor(matchedProduct, parsedItem.flavorHint);
          await addToChatCart(chatSessionId, matchedProduct.id, variantId, parsedItem.quantity);
          const flavorLabel = parsedItem.flavorHint === 'pedas' ? 'Pedas' : (parsedItem.flavorHint === 'non_pedas' ? 'Original' : 'Default');
          addedProducts.push(`${parsedItem.quantity}x ${matchedProduct.name} (${flavorLabel})`);
        }
      }

      if (addedProducts.length > 0) {
        const cart = await getChatCart(chatSessionId);
        const methods = await getActivePaymentMethods();
        let preferredMethods = methods;
        if (complexOrder.wantsCod) preferredMethods = methods.filter((method) => method.type === 'cod');
        else if (complexOrder.wantsTransfer) preferredMethods = methods.filter((method) => method.type !== 'cod');
        const preferredMethod = preferredMethods[0] || methods[0];
        const useSavedData = complexOrder.wantsOldAddress && customerContext.customer;

        const reply = `Siap kak, aku sudah siapkan pesanan kakak: ${addedProducts.join(', ')}.` +
          (complexOrder.wantsCod && preferredMethod ? ` Pilihan pembayaran diset ke COD.` : '') +
          (useSavedData ? ` Menggunakan data penerima dan alamat tersimpan.` : ` Silakan lengkapi alamat dan konfirmasi pesanan di bawah.`);

        return { reply, intent: 'confirm_order', components: [
          { type: 'cart_summary', cartId: cart.id },
          ...(preferredMethod ? [{ type: 'payment_methods' as const, methodIds: preferredMethods.map((method) => method.id) }] : []),
          { type: 'order_summary', orderDraftId: chatSessionId, ...(preferredMethod ? { paymentMethodId: preferredMethod.id } : {}), ...(customerContext.customer ? { savedCustomerId: customerContext.customer.id } : {}), ...(customerContext.defaultAddress && useSavedData ? { savedAddressId: customerContext.defaultAddress.id } : {}), actions: ['confirm_order', 'edit_cart', 'edit_address'] },
        ], nextAction: 'confirm_order', confidence: 0.94 };
      }
    }

    if (/keranjang|cart|checkout|pesan sekarang|lanjut/.test(lower)) {
      const cart = await getChatCart(chatSessionId);
      return { reply: cart.itemCount > 0 ? 'Ini ringkasan keranjang kak.' : 'Keranjang masih kosong kak. Pilih produk dulu ya.', intent: 'show_cart', components: cart.itemCount > 0 ? [{ type: 'cart_summary', cartId: cart.id }] : defaultQuickReplies(), confidence: 0.86 };
    }

    if (/produk|keripik|kripik|rasa|pedas|original|keluarga|oleh|budget|hemat|rekomendasi|mau/.test(lower)) {
      const products = await recommendProducts(message, customerContext.memory);
      const productIds = products.map((product) => product.id);
      await logRecommendationEvent({ eventType: 'shown', chatSessionId, customerId: customerContext.customer?.id, productIds, reason: 'deterministic_recommendation', metadata: { message } });
      return { reply: 'Siap kak, ini pilihan yang cocok.', intent: 'recommend_products', components: productComponents(productIds), nextAction: 'wait_product_selection', confidence: 0.88 };
    }

    if (/halo|hai|pagi|siang|sore|malam/.test(lower)) {
      if (customerContext.customer) {
        const name = customerContext.customer.name;
        return { reply: `Halo kak${name ? ` ${name}` : ''}! Mau pesan keripik apa hari ini?`, intent: 'small_talk', components: defaultQuickReplies(), confidence: 0.9 };
      }
      return { reply: 'Halo! Mau pesan keripik apa hari ini?', intent: 'small_talk', components: defaultQuickReplies(), confidence: 0.85 };
    }
  }

  // ── CHECKOUT STAGES ──

  if (CHECKOUT_STAGES.includes(stage)) {
    if (/^(ya|pakai|gunakan).*(data|alamat)|data ini|alamat ini/.test(lower) && customerContext.customer) {
      return { reply: customerContext.defaultAddress ? 'Siap kak, aku pakai data tersimpan. Sekarang lanjut ke pembayaran ya.' : 'Siap kak, data customer dipakai. Tinggal lengkapi alamat pengiriman ya.', intent: 'confirm_customer_data', components: customerContext.defaultAddress ? defaultQuickReplies() : [{ type: 'location_picker', mode: 'both' }], confidence: 0.92 };
    }

    if (/(ubah|ganti|edit).*(nama|nomor|wa|whatsapp|penerima|alamat)|^(nama|nomor|alamat) (baru|saya)/.test(lower)) {
      return { reply: /alamat/.test(lower) ? 'Siap kak, kita ubah alamat pengiriman dulu ya.' : 'Siap kak, kita perbarui data penerima dulu ya.', intent: /alamat/.test(lower) ? 'request_location' : 'ask_customer_data', components: /alamat/.test(lower) ? [{ type: 'location_picker', mode: 'both' }] : [{ type: 'order_summary', orderDraftId: chatSessionId }], confidence: 0.95 };
    }

    if (/ganti (ke|jadi) (transfer|bank|cod|bayar)/.test(lower) || complexOrder.wantsTransfer) {
      const methods = await getActivePaymentMethods();
      const isCod = /cod/.test(lower);
      const filtered = isCod ? methods.filter((m) => m.type === 'cod') : methods.filter((m) => m.type !== 'cod');
      return { reply: isCod ? 'Siap kak, pembayaran diganti ke COD (Bayar di Tempat).' : 'Siap kak, pembayaran diganti ke transfer/online.', intent: 'show_payment', components: [{ type: 'payment_methods', methodIds: (filtered.length > 0 ? filtered : methods).map((method) => method.id) }], nextAction: 'select_payment_method', confidence: 0.93 };
    }

    if (/bayar|pembayaran|qris|transfer|cod/.test(lower)) {
      const methods = await getActivePaymentMethods();
      return { reply: 'Ini metode pembayaran yang sedang aktif ya kak.', intent: 'show_payment', components: [{ type: 'payment_methods', methodIds: methods.map((method) => method.id) }], nextAction: 'select_payment_method', confidence: 0.9 };
    }

    if (/lokasi|alamat|kirim|pengiriman/.test(lower)) {
      if (customerContext.defaultAddress && !/ubah|baru|ganti/.test(lower)) {
        return { reply: 'Aku menemukan alamat tersimpan. Mau pakai alamat ini?', intent: 'request_location', components: [{ type: 'address_confirm', addressId: customerContext.defaultAddress.id, address: customerContext.defaultAddress, actions: ['use_saved_address', 'edit_address', 'send_new_location'] }], confidence: 0.9 };
      }
      return { reply: 'Biar pengiriman lebih tepat, kakak bisa isi alamat atau kirim titik lokasi.', intent: 'request_location', components: [{ type: 'location_picker', mode: 'both' }], confidence: 0.86 };
    }
  }

  return { reply: 'Aku bisa bantu pilih produk, cek keranjang, pembayaran, dan status pesanan kak.', intent: 'small_talk', components: defaultQuickReplies(), confidence: 0.58 };
}

export async function buildPausedChatResponse(chatSessionId: string, message: string): Promise<AIChatResponse | null> {
  const lower = message.toLowerCase();

  if (/status|lacak|cek pesanan|pesanan saya/.test(lower)) {
    const customerContext = await getCustomerContextForChat(chatSessionId);
    if (customerContext.lastOrder) {
      return { reply: 'Admin sedang menangani chat ini, tapi status pesanan terakhir tetap bisa kamu cek di sini ya kak.', intent: 'track_order', components: [{ type: 'order_status_card', orderId: customerContext.lastOrder.id, orderCode: customerContext.lastOrder.code, status: customerContext.lastOrder.status, paymentStatus: customerContext.lastOrder.paymentStatus, deliveryStatus: customerContext.lastOrder.status, totalAmount: customerContext.lastOrder.totalAmount }], confidence: 0.96 };
    }
    return { reply: 'Admin sedang menangani chat ini. Kalau mau, kakak tetap bisa buka halaman Pesanan Saya ya.', intent: 'track_order', components: [{ type: 'quick_replies', options: [{ id: 'paused-track', label: 'Buka Pesanan Saya', value: '/pesan/saya', action: 'tool_action' }] }], confidence: 0.94 };
  }

  if (/produk|keripik|kripik|rasa|pedas|original|keluarga|oleh|budget|hemat|rekomendasi|warung|reseller|kantor|acara/.test(lower)) {
    const customerContext = await getCustomerContextForChat(chatSessionId);
    const products = await recommendProducts(message, customerContext.memory);
    return { reply: 'Admin sedang menangani chat ini, tapi katalog tetap bisa kakak lihat dulu ya.', intent: 'recommend_products', components: productComponents(products.map((product) => product.id)), confidence: 0.93 };
  }

  if (/keranjang|cart|checkout/.test(lower)) {
    const cart = await getChatCart(chatSessionId);
    return { reply: cart.itemCount > 0 ? 'Admin sedang menangani chat ini, tapi keranjang kakak masih bisa dilihat di bawah ya.' : 'Sambil menunggu admin, kakak bisa lihat katalog dulu ya.', intent: 'show_cart', components: cart.itemCount > 0 ? [{ type: 'cart_summary', cartId: cart.id }] : defaultQuickReplies(), confidence: 0.92 };
  }

  if (/bayar|pembayaran|qris|transfer|cod|bukti/.test(lower)) {
    const methods = await getActivePaymentMethods();
    return { reply: 'Admin sedang menangani chat ini, tapi metode pembayaran aktif tetap bisa kamu lihat ya kak.', intent: 'show_payment', components: [{ type: 'payment_methods', methodIds: methods.map((method) => method.id) }], confidence: 0.91 };
  }

  return null;
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

type RecommendedProduct = Awaited<ReturnType<typeof recommendProducts>>[number];

type ComplexOrderIntent = {
  quantity: number;
  multiFlavor: boolean;
  wantsCod: boolean;
  wantsTransfer?: boolean;
  wantsOldAddress?: boolean;
  wantsReOrder?: boolean;
  wantsChangeAddress?: boolean;
  wantsReduceCart?: boolean;
  wantsAddMore?: boolean;
  wantsRemoveProduct?: string | null;
  shouldPrepareOrder: boolean;
  needsProofUploadHelp: boolean;
  isWholesaleContext: boolean;
  flavorHint: 'pedas' | 'non_pedas' | 'mixed' | null;
  items?: Array<{ quantity: number; flavorHint: 'pedas' | 'non_pedas' | null }>;
};

function parseComplexOrderIntent(lower: string): ComplexOrderIntent {
  const wantsCod = /\bcod\b|bayar di tempat/.test(lower);
  const wantsTransfer = /\btransfer\b|\bbank\b|\bbayar manual\b|\bganti.*transfer\b/.test(lower);
  const needsProofUploadHelp = /(sudah transfer|bukti|upload).*(belum|nanti|malam|upload)|upload.*bukti|bukti.*upload/.test(lower);
  const hasOrderVerb = /(langsung|sekalian|tolong|bisa|mau|pesan|order|butuh|untuk|tambah)/.test(lower);
  const hasOrderContext = /keluarga|warung|reseller|kantor|acara|stok|jual lagi|oleh/.test(lower);
  const wantsOldAddress = /alamat lama|alamat kemarin|seperti biasa|alamat (yang )?dulu|pakai alamat/.test(lower);
  const wantsReOrder = /pesan ulang|order (lagi|ulang)|sama (kayak|seperti) (yang )?kemarin|sama (lagi|ya)|beli (lagi|ulang)/.test(lower);
  const wantsReduceCart = /kurangi|hapus|buang|dikurangi|dihapus|jangan jadi/.test(lower);
  const wantsAddMore = /tambah (lagi|sekali|dong|ya|deh)|nambah|lagi donk|masih ada|masih kurang/.test(lower);
  const wantsRemoveProduct = lower.match(/(?:hapus|buang|keluarkan)\s+(\w+)/)?.[1] || null;
  const isWholesaleContext = /banyak|grosir|warung|reseller|jual (lagi|kembali)|partai|borongan/.test(lower);

  const segments = lower.split(/\s*(?:\+|,|\/| dan | lalu | terus | sama )\s*/i).filter(Boolean);
  const items: Array<{ quantity: number; flavorHint: 'pedas' | 'non_pedas' | null }> = [];

  for (const segment of segments) {
    const hasDigit = /(?:^|\s)(\d{1,2})\b/.test(segment);
    const hasWord = /\b(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)\b/.test(segment);
    const quantity = (hasDigit || hasWord) ? extractRequestedQuantity(segment) : 0;
    const hasPedas = segment.includes('pedas') || /balado|cabe|spicy|cabe/.test(segment);
    const hasOriginal = /(original|non pedas|ga pedas|nggak pedas|keju|jagung|asin|gurih|bawang|mix)/.test(segment);
    if (quantity > 0 || hasPedas || hasOriginal) {
      items.push({ quantity: quantity || 1, flavorHint: hasPedas ? 'pedas' : (hasOriginal ? 'non_pedas' : null) });
    }
  }

  if (items.length === 0 && (hasOrderVerb || hasOrderContext)) {
    const quantity = extractRequestedQuantity(lower);
    const hasPedas = lower.includes('pedas') || /balado|cabe|spicy/.test(lower);
    const hasOriginal = /(original|non pedas|ga pedas|nggak pedas|keju|jagung|asin|gurih|bawang|mix)/.test(lower);
    items.push({ quantity: quantity || 1, flavorHint: hasPedas ? 'pedas' : (hasOriginal ? 'non_pedas' : null) });
  }

  const isHandoff = /admin|manusia|komplain|bantuan|marah|kecewa|refund|diskon/.test(lower);
  const isAddressEdit = /(ubah|ganti|edit).*(nama|nomor|wa|whatsapp|penerima|alamat)|^(nama|nomor|alamat) (baru|saya)/.test(lower);
  const isTracking = /status|lacak|cek pesanan|pesanan saya/.test(lower);

  const shouldPrepareOrder = items.length > 0 &&
    (hasOrderVerb || wantsCod || wantsTransfer || hasOrderContext || wantsOldAddress || wantsReOrder) &&
    !isHandoff && !isAddressEdit && !isTracking;

  return {
    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    multiFlavor: items.length > 1,
    wantsCod,
    wantsTransfer,
    wantsOldAddress,
    wantsReOrder,
    wantsChangeAddress: /ganti alamat|ubah alamat|pindah alamat/.test(lower),
    wantsReduceCart,
    wantsAddMore,
    wantsRemoveProduct,
    needsProofUploadHelp,
    shouldPrepareOrder,
    isWholesaleContext,
    items,
    flavorHint: items[0]?.flavorHint || null,
  };
}

function extractRequestedQuantity(lower: string) {
  const digitMatch = lower.match(/(?:^|\s)(\d{1,3})(?:\s*(?:pcs?|pack|paket|bungkus|item|rasa|varian|dus|karton))?/);
  if (digitMatch) return Math.max(1, Math.min(30, Number(digitMatch[1])));

  const words: Record<string, number> = {
    satu: 1, pertama: 1,
    dua: 2, kedua: 2,
    tiga: 3, ketiga: 3,
    empat: 4, keempat: 4,
    lima: 5, kelima: 5,
    enam: 6, keenam: 6,
    tujuh: 7, ketujuh: 7,
    delapan: 8, kedelapan: 8,
    sembilan: 9, kesembilan: 9,
    sepuluh: 10, kesepuluh: 10,
  };

  for (const [word, value] of Object.entries(words)) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) return value;
  }
  return 1;
}

function findMatchedProduct(products: RecommendedProduct[], flavorHint: 'pedas' | 'non_pedas' | null) {
  if (products.length === 0) return null;
  if (!flavorHint) return products[0];
  const matched = products.find((product) => {
    const text = `${product.name} ${product.description || ''} ${product.tags.join(' ')}`.toLowerCase();
    if (flavorHint === 'pedas') return /pedas|spicy|balado|cabe|hot/.test(text);
    if (flavorHint === 'non_pedas') return /original|asin|manis|keju|jagung|gurih/.test(text) && !/pedas|spicy|balado|cabe/.test(text);
    return false;
  });
  return matched || products[0];
}

function selectVariantIdForFlavor(product: RecommendedProduct, flavorHint: 'pedas' | 'non_pedas' | null) {
  const activeVariants = product.variants.filter((variant) => variant.stock > 0);
  if (activeVariants.length === 0) return undefined;
  const lowered = activeVariants.map((variant) => ({ ...variant, lower: `${variant.name} ${variant.id}`.toLowerCase() }));
  if (flavorHint === 'pedas') return lowered.find((variant) => /pedas|spicy|balado|cabe|hot/.test(variant.lower))?.id || lowered[0].id;
  if (flavorHint === 'non_pedas') return lowered.find((variant) => /original|asin|manis|keju|jagung|gurih/.test(variant.lower) && !/pedas|spicy|balado|cabe/.test(variant.lower))?.id || lowered[0].id;
  return lowered[0].id;
}

function parseJsonObject(text: string) {
  try { return JSON.parse(text); } catch {
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

function isComplexMessage(message: string): boolean {
  const lower = message.toLowerCase();
  const multiIntentPatterns = [
    /dan\s*(bayar|kirim|pakai|pake)/,
    /lalu\s*(bayar|kirim|pakai|pake)/,
    /terus\s*(bayar|kirim|pakai|pake)/,
    /sekalian\s*(bayar|kirim|pakai|pake)/,
    /sama\s+(bayar|kirim)/,
  ];
  if (multiIntentPatterns.some((p) => p.test(lower))) return true;
  const keywordCount = ['pesan', 'beli', 'order', 'bayar', 'kirim', 'alamat', 'pakai', 'pake', 'cod', 'qris', 'transfer']
    .filter((keyword) => lower.includes(keyword)).length;
  if (keywordCount >= 3) return true;
  return false;
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
