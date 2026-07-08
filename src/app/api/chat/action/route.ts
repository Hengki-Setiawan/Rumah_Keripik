import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatSessions } from '@/lib/schema';
import { ChatActionSchema, CreateChatOrderSchema } from '@/lib/chat-v3/schemas';
import { createChatMessage, getChatMessages } from '@/lib/chat-v3/messages';
import { addToChatCart, getChatCart, updateChatCartItem } from '@/lib/ai/tools/cart';
import { getActivePaymentMethods } from '@/lib/ai/tools/payment';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { createOrderFromChatCart } from '@/lib/orders/create-chat-order';
import { getCustomerContextForChat, linkChatSessionToCustomer } from '@/lib/chat-v3/customer-context';
import { rememberOrderFacts, upsertCustomerMemory } from '@/lib/chat-v3/memory';
import { logAiLearningEvent, logRecommendationEvent } from '@/lib/ai/learning-events';
import { getSavedCheckoutData } from '@/lib/chat-v3/saved-checkout';
import { getChatV3Stage } from '@/lib/chat-v3/stage';
import { chatOwnershipErrorResponse, requireOwnedChatSession } from '@/lib/chat-v3/ownership';

export async function POST(req: Request) {
  const rate = checkRateLimit(`chat-action:${getClientIp(req)}`, 80, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak aksi. Coba lagi sebentar.' }, { status: 429 });

  const parsed = ChatActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Aksi tidak valid' }, { status: 400 });

  const { chatSessionId, action, payload = {} } = parsed.data;
  try {
    await requireOwnedChatSession(chatSessionId);
  } catch (error) {
    const ownership = chatOwnershipErrorResponse(error);
    if (ownership) return NextResponse.json({ ok: false, error: ownership.error }, { status: ownership.status });
    throw error;
  }
  let orderCookieToken: string | null = null;
  let orderStatusUrl: string | null = null;

  try {
    if (action === 'refresh_chat') {
      // Client-side refresh after external actions such as payment proof upload.
    } else if (action === 'message_feedback') {
      await logAiLearningEvent({
        eventType: 'chat_message_feedback',
        chatSessionId,
        outcome: String(payload.label || 'helpful'),
        rating: Number(payload.rating || 5),
        metadata: {
          messageId: String(payload.messageId || ''),
        },
      });
    } else if (action === 'show_cart') {
      const cart = await getChatCart(chatSessionId);
      await createChatMessage({
        chatSessionId,
        role: 'assistant',
        content: cart.itemCount > 0 ? 'Ini keranjang belanja kakak saat ini.' : 'Keranjang kakak masih kosong. Mau aku bantu pilih produk?',
        components: cart.itemCount > 0
          ? [{ type: 'cart_summary', cartId: cart.id }]
          : [{
              type: 'quick_replies',
              options: [
                { id: 'lihat-produk', label: 'Lihat produk', value: 'Lihat produk', action: 'send_message' },
                { id: 'rekomendasi', label: 'Rekomendasi pedas', value: 'Rekomendasi keripik pedas', action: 'send_message' },
              ],
            }],
      });
    } else if (action === 'help_overview') {
      await createChatMessage({
        chatSessionId,
        role: 'assistant',
        content: 'Aku bisa bantu cek keranjang, ubah alamat, pilih pembayaran, lacak pesanan, atau teruskan ke admin kalau perlu.',
        components: [{
          type: 'quick_replies',
          options: [
            { id: 'bantuan-keranjang', label: 'Lihat keranjang', value: 'Lihat keranjang saya', action: 'send_message' },
            { id: 'bantuan-alamat', label: 'Ubah alamat', value: 'Saya mau ubah alamat pengiriman', action: 'send_message' },
            { id: 'bantuan-lacak', label: 'Lacak pesanan', value: '/pesan/lacak', action: 'tool_action' },
            { id: 'bantuan-admin', label: 'Hubungi admin', value: 'Saya butuh bantuan admin', action: 'send_message' },
          ],
        }],
      });
    } else if (action === 'add_to_cart') {
      const productId = String(payload.productId || '');
      const variantId = payload.variantId ? String(payload.variantId) : undefined;
      const quantity = Number(payload.quantity || 1);
      const cart = await addToChatCart(chatSessionId, productId, variantId, quantity);
      await logRecommendationEvent({ eventType: 'added_to_cart', chatSessionId, productIds: [productId], selectedProductId: productId, metadata: { variantId, quantity } });
      await createChatMessage({ chatSessionId, role: 'assistant', content: 'Sudah aku tambahkan ke keranjang kak.', components: [{ type: 'cart_summary', cartId: cart.id }] });
    } else if (action === 'update_cart_item') {
      const cart = await updateChatCartItem(chatSessionId, String(payload.itemId || ''), Number(payload.quantity || 0));
      await createChatMessage({ chatSessionId, role: 'assistant', content: cart.itemCount > 0 ? 'Keranjang sudah aku update.' : 'Keranjang sudah kosong kak.', components: cart.itemCount > 0 ? [{ type: 'cart_summary', cartId: cart.id }] : [] });
    } else if (action === 'show_payment_methods') {
      const methods = await getActivePaymentMethods();
      await createChatMessage({ chatSessionId, role: 'assistant', content: 'Pilih metode pembayaran yang tersedia ya kak.', components: [{ type: 'payment_methods', methodIds: methods.map((method) => method.id) }] });
    } else if (action === 'select_payment_method') {
      const paymentMethodId = String(payload.paymentMethodId || payload.methodId || '');
      const context = await getCustomerContextForChat(chatSessionId);
      await createChatMessage({
        chatSessionId,
        role: 'assistant',
        content: context.customer && context.defaultAddress
          ? 'Metode pembayaran sudah dipilih. Kakak bisa langsung buat order memakai data tersimpan.'
          : 'Metode pembayaran sudah dipilih. Lengkapi data penerima dan alamat untuk membuat order ya kak.',
        components: [{ type: 'order_summary', orderDraftId: chatSessionId, paymentMethodId, savedCustomerId: context.customer?.id, savedAddressId: context.defaultAddress?.id }],
        metadata: { paymentMethodId },
      });
    } else if (action === 'create_order') {
      const stage = await getChatV3Stage(chatSessionId);
      if (!['payment_selection', 'cart_building', 'customer_data_required', 'address_required'].includes(stage)) throw new Error(`Order belum bisa dibuat dari stage ${stage}`);
      const orderInput = CreateChatOrderSchema.parse({ chatSessionId, ...payload });
      const result = await createOrderFromChatCart(orderInput);
      await rememberOrderFacts(chatSessionId, result.idTransaksi);
      await logRecommendationEvent({ eventType: 'ordered', chatSessionId, productIds: result.productIds || [], reason: 'chat_order_created', metadata: { orderId: result.idTransaksi, total: result.totalBayar } });
      await logAiLearningEvent({ eventType: 'chat_order_created', chatSessionId, customerId: result.customerId, productIds: result.productIds || [], outcome: 'order_created', metadata: { orderId: result.idTransaksi, paymentMethod: result.paymentMethod } });
      const statusUrl = `/pesan/sukses/${encodeURIComponent(result.kodePesanan)}?token=${encodeURIComponent(result.statusToken)}`;
      orderCookieToken = result.anonymousToken;
      orderStatusUrl = statusUrl;
      await createChatMessage({
        chatSessionId,
        role: 'system',
        content: result.paymentMethod === 'cod'
          ? 'Order COD berhasil dibuat. Admin akan mengecek dan mengonfirmasi pesanan kakak.'
          : 'Order berhasil dibuat. Silakan bayar sesuai instruksi, lalu upload bukti dari halaman status.',
        components: [
          { type: 'order_status_card', orderId: result.idTransaksi, status: 'awaiting_payment', paymentStatus: result.statusPembayaran },
          ...(result.paymentMethod === 'cod' ? [] : [{ type: 'payment_upload' as const, orderId: result.idTransaksi, statusToken: result.statusToken }]),
          { type: 'quick_replies', options: [{ id: 'lihat-status', label: 'Lihat Status', value: statusUrl, action: 'tool_action' }] },
        ],
        metadata: { order: result },
      });
    } else if (action === 'create_order_saved') {
      const stage = await getChatV3Stage(chatSessionId);
      if (!['payment_selection', 'cart_building', 'customer_data_required', 'address_required'].includes(stage)) throw new Error(`Order belum bisa dibuat dari stage ${stage}`);
      const saved = await getSavedCheckoutData(chatSessionId, payload.addressId ? Number(payload.addressId) : undefined);
      const orderInput = CreateChatOrderSchema.parse({
        chatSessionId,
        customer: saved.customer,
        address: saved.address,
        paymentMethodId: String(payload.paymentMethodId || ''),
        notes: String(payload.notes || 'Order memakai data tersimpan'),
      });
      const result = await createOrderFromChatCart(orderInput);
      await rememberOrderFacts(chatSessionId, result.idTransaksi);
      await logRecommendationEvent({ eventType: 'ordered', chatSessionId, productIds: result.productIds || [], reason: 'chat_order_created', metadata: { orderId: result.idTransaksi, total: result.totalBayar } });
      await logAiLearningEvent({ eventType: 'chat_order_created', chatSessionId, customerId: result.customerId, productIds: result.productIds || [], outcome: 'order_created', metadata: { orderId: result.idTransaksi, paymentMethod: result.paymentMethod } });
      const statusUrl = `/pesan/sukses/${encodeURIComponent(result.kodePesanan)}?token=${encodeURIComponent(result.statusToken)}`;
      orderCookieToken = result.anonymousToken;
      orderStatusUrl = statusUrl;
      await createChatMessage({
        chatSessionId,
        role: 'system',
        content: result.paymentMethod === 'cod'
          ? 'Order COD berhasil dibuat memakai data tersimpan. Admin akan mengecek dan mengonfirmasi pesanan kakak.'
          : 'Order berhasil dibuat memakai data tersimpan. Silakan bayar sesuai instruksi, lalu upload bukti dari halaman status.',
        components: [
          { type: 'order_status_card', orderId: result.idTransaksi, status: 'awaiting_payment', paymentStatus: result.statusPembayaran },
          ...(result.paymentMethod === 'cod' ? [] : [{ type: 'payment_upload' as const, orderId: result.idTransaksi, statusToken: result.statusToken }]),
          { type: 'quick_replies', options: [{ id: 'lihat-status', label: 'Lihat Status', value: statusUrl, action: 'tool_action' }] },
        ],
        metadata: { order: result, savedCheckout: true },
      });
    } else if (action === 'request_location') {
      await createChatMessage({ chatSessionId, role: 'assistant', content: 'Kakak bisa kirim titik lokasi atau isi alamat manual.', components: [{ type: 'location_picker', mode: 'both' }] });
    } else if (action === 'use_saved_customer' || action === 'use_saved_address') {
      const context = await getCustomerContextForChat(chatSessionId);
      if (context.customer) await linkChatSessionToCustomer(chatSessionId, context.customer.id);
      await createChatMessage({
        chatSessionId,
        role: 'assistant',
        content: context.defaultAddress ? 'Siap kak, data tersimpan dipakai. Kakak bisa lanjut pilih pembayaran atau buat order.' : 'Siap kak, data customer dipakai. Tinggal lengkapi alamat pengiriman ya.',
        components: context.defaultAddress ? [{ type: 'cart_summary', cartId: (await getChatCart(chatSessionId)).id }] : [{ type: 'location_picker', mode: 'both' }],
      });
    } else if (action === 'edit_customer_data') {
      await createChatMessage({
        chatSessionId,
        role: 'assistant',
        content: 'Baik kak, kita isi ulang data penerima dan alamatnya dari sini ya.',
        components: [{ type: 'order_summary', orderDraftId: chatSessionId }],
      });
    } else if (action === 'edit_address') {
      await createChatMessage({
        chatSessionId,
        role: 'assistant',
        content: 'Siap kak, kirim alamat baru atau titik lokasi yang paling akurat ya.',
        components: [{ type: 'location_picker', mode: 'both' }],
      });
    } else if (action === 'save_customer_memory_preference') {
      const context = await getCustomerContextForChat(chatSessionId);
      if (!context.customer) return NextResponse.json({ ok: false, error: 'Customer belum terhubung' }, { status: 400 });
      await upsertCustomerMemory({ customerId: context.customer.id, key: String(payload.key || 'preferensi'), value: String(payload.value || ''), source: 'chat', confidence: 70 });
      await createChatMessage({ chatSessionId, role: 'assistant', content: 'Preferensi kakak sudah aku simpan untuk pesanan berikutnya.' });
    } else if (action === 'admin_handoff') {
      await db.update(chatSessions).set({ status: 'needs_admin', aiMode: 'paused', updatedAt: sql`(datetime('now', 'utc'))` }).where(eq(chatSessions.id, chatSessionId));
      await createChatMessage({ chatSessionId, role: 'system', content: 'Chat ditandai butuh admin.', components: [{ type: 'admin_handoff_card', reason: String(payload.reason || 'Butuh bantuan admin') }] });
    } else {
      return NextResponse.json({ ok: false, error: 'Aksi belum tersedia' }, { status: 400 });
    }

    const response = NextResponse.json({ ok: true, statusUrl: orderStatusUrl, messages: await getChatMessages(chatSessionId), cart: await getChatCart(chatSessionId) });
    if (orderCookieToken) {
      (await cookies()).set('rk_order_session', orderCookieToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Aksi gagal' }, { status: 400 });
  }
}
