import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatSessions, produk } from '@/lib/schema';
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
import { getOrCreateIdentityFlow, updateIdentityFlow } from '@/lib/identity/flow';
import { chatOwnershipErrorResponse, requireOwnedChatSession } from '@/lib/chat-v3/ownership';

export async function POST(req: Request) {
  const rate = await checkRateLimit(`chat-action:${getClientIp(req)}`, 80, 60_000);
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
    } else if (action === 'cart_carryover_notice') {
      // Deteksi cart dari sesi sebelumnya
      const cart = await getChatCart(chatSessionId);
      const itemCount = cart.itemCount;
      await createChatMessage({
        chatSessionId,
        role: 'assistant',
        content: `Keranjang kamu masih ada ${itemCount} item dari sesi sebelumnya. Mau lanjutkan atau mulai dari awal?`,
        components: [
          { type: 'cart_summary', cartId: cart.id },
          { type: 'quick_replies', options: [
            { id: 'carryover-lanjut', label: 'Lanjutkan', value: 'lanjut checkout', action: 'send_message' },
            { id: 'carryover-baru', label: 'Mulai baru', value: 'kosongkan keranjang', action: 'send_message' },
          ] },
        ],
        metadata: { intent: 'show_cart', carryover: true },
      });
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
        content: 'Aku bisa bantu cek keranjang, ubah alamat, pilih pembayaran, buka Pesanan Saya, atau teruskan ke admin kalau perlu.',
        components: [{
          type: 'quick_replies',
          options: [
            { id: 'bantuan-produk', label: 'Lihat produk', value: 'Lihat produk', action: 'send_message' },
            { id: 'bantuan-keranjang', label: 'Lihat keranjang', value: 'Lihat keranjang saya', action: 'send_message' },
            { id: 'bantuan-alamat', label: 'Ubah alamat', value: 'Saya mau ubah alamat pengiriman', action: 'send_message' },
            { id: 'bantuan-lacak', label: 'Pesanan saya', value: '/pesan/saya', action: 'tool_action' },
            { id: 'bantuan-admin', label: 'Hubungi admin', value: 'Saya butuh bantuan admin', action: 'send_message' },
          ],
        }],
      });
    } else if (action === 'add_to_cart') {
      const productId = String(payload.productId || '');
      const variantId = payload.variantId ? String(payload.variantId) : undefined;
      const quantity = Number(payload.quantity || 1);
      const cart = await addToChatCart(chatSessionId, productId, variantId, quantity);
      const [productRow] = await db.select({ name: produk.nama_produk }).from(produk).where(eq(produk.id_produk, productId)).limit(1);
      const productName = productRow?.name || 'Produk';
      const itemText = quantity > 1 ? `${productName} (${quantity}x)` : productName;
      await logRecommendationEvent({ eventType: 'added_to_cart', chatSessionId, productIds: [productId], selectedProductId: productId, metadata: { variantId, quantity } });
      await createChatMessage({ chatSessionId, role: 'assistant', content: `🛒 ${itemText} berhasil ditambahkan ke keranjang kak!`, components: [{ type: 'cart_summary', cartId: cart.id }] });
    } else if (action === 'update_cart_item') {
      // Update kuantitas/hapus item TANPA menyisipkan pesan baru.
      // Kartu keranjang sudah live dari state cart (ChatShell.setCart) — klik +/− cukup
      // meng-update kartu yang sedang tampil, tidak menumpuk kartu baru di bawah.
      await updateChatCartItem(chatSessionId, String(payload.itemId || ''), Number(payload.quantity || 0));
    } else if (action === 'show_payment_methods') {
      const methods = await getActivePaymentMethods();
      await createChatMessage({ chatSessionId, role: 'assistant', content: 'Pilih metode pembayaran yang tersedia ya kak.', components: [{ type: 'payment_methods', methodIds: methods.map((method) => method.id) }] });
    } else if (action === 'select_payment_method') {
      const paymentMethodId = String(payload.paymentMethodId || payload.methodId || '');
      const context = await getCustomerContextForChat(chatSessionId);
      await logAiLearningEvent({ eventType: 'payment_method_selected', chatSessionId, customerId: context.customer?.id, intent: 'show_payment', metadata: { paymentMethodId, hasAddress: Boolean(context.defaultAddress), identified: Boolean(context.customer) } });
      if (!context.customer) {
        await getOrCreateIdentityFlow(chatSessionId);
        await updateIdentityFlow(chatSessionId, { purpose: 'login', step: 'ask_phone_login' });
        await createChatMessage({
          chatSessionId,
          role: 'assistant',
          content: 'Sebentar kak, verifikasi WhatsApp dulu supaya data kakak tersimpan otomatis. Masukkan nomor WhatsApp yang dipakai sebelumnya ya.',
        });
      } else {
        await createChatMessage({
          chatSessionId,
          role: 'assistant',
          content: context.customer && context.defaultAddress
            ? 'Metode pembayaran sudah dipilih. Kakak bisa langsung buat order memakai data tersimpan.'
            : 'Metode pembayaran sudah dipilih. Lengkapi alamat pengiriman dulu untuk membuat order ya kak.',
          components: context.customer && context.defaultAddress
            ? [{ type: 'order_summary', orderDraftId: chatSessionId, paymentMethodId, savedCustomerId: context.customer.id, savedAddressId: context.defaultAddress.id, customer: context.customer, address: context.defaultAddress, addresses: context.addresses, actions: ['confirm_order', 'edit_cart', 'edit_address'] }]
            : [{ type: 'location_picker', mode: 'both' }],
          metadata: { paymentMethodId },
        });
      }
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
      if (result.paymentMethod !== 'cod' && result.checkoutUrl) {
        await logAiLearningEvent({ eventType: 'payment_qris_viewed', chatSessionId, customerId: result.customerId, intent: 'show_payment', metadata: { orderId: result.idTransaksi, provider: result.paymentProvider, hasQrString: Boolean(result.qrString) } });
      }
      const paymentItems = result.paymentMethod === 'cod' ? [] : (await getChatCart(chatSessionId)).items.map((item) => ({
        name: item.productName,
        variantName: item.variantName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      }));
      await createChatMessage({
        chatSessionId,
        role: 'system',
        content: result.paymentMethod === 'cod'
          ? 'Order COD berhasil dibuat! Admin akan mengecek dan mengonfirmasi pesanan kakak. Biasanya direspons dalam 1\u20132 jam kerja ya kak.'
          : result.checkoutUrl
            ? 'Order berhasil dibuat! Silakan scan QRIS di bawah ini untuk membayar. Pembayaran akan dikonfirmasi otomatis setelah berhasil.'
            : 'Order berhasil dibuat, tetapi QRIS belum siap. Coba buka status pesanan dulu ya kak, atau refresh chat sebentar.',
        components: [
          { type: 'order_status_card', orderId: result.idTransaksi, status: 'awaiting_payment', paymentStatus: result.statusPembayaran },
          ...(result.paymentMethod !== 'cod' && result.checkoutUrl ? [{ type: 'payment_upload' as const, orderId: result.idTransaksi, qrCodeUrl: result.checkoutUrl, qrString: result.qrString || null, amount: result.totalBayar, items: paymentItems }] : []),
          { type: 'quick_replies', options: [
            { id: 'lihat-status', label: 'Lihat status', value: statusUrl, action: 'tool_action' as const },
            { id: 'pesanan-saya', label: 'Pesanan saya', value: '/pesan/saya', action: 'tool_action' as const },
          ] },
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
      if (result.paymentMethod !== 'cod' && result.checkoutUrl) {
        await logAiLearningEvent({ eventType: 'payment_qris_viewed', chatSessionId, customerId: result.customerId, intent: 'show_payment', metadata: { orderId: result.idTransaksi, provider: result.paymentProvider, savedCheckout: true, hasQrString: Boolean(result.qrString) } });
      }
      const savedPaymentItems = result.paymentMethod === 'cod' ? [] : (await getChatCart(chatSessionId)).items.map((item) => ({
        name: item.productName,
        variantName: item.variantName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      }));
      await createChatMessage({
        chatSessionId,
        role: 'system',
        content: result.paymentMethod === 'cod'
          ? 'Order COD berhasil dibuat memakai data tersimpan. Admin akan mengecek dan mengonfirmasi pesanan kakak.'
          : result.checkoutUrl
            ? 'Order berhasil dibuat memakai data tersimpan. Silakan scan QRIS di bawah ini untuk membayar ya kak.'
            : 'Order berhasil dibuat memakai data tersimpan, tetapi QRIS belum siap. Coba buka status pesanan dulu ya kak.',
        components: [
          { type: 'order_status_card', orderId: result.idTransaksi, status: 'awaiting_payment', paymentStatus: result.statusPembayaran },
          ...(result.paymentMethod !== 'cod' && result.checkoutUrl ? [{ type: 'payment_upload' as const, orderId: result.idTransaksi, qrCodeUrl: result.checkoutUrl, qrString: result.qrString || null, amount: result.totalBayar, items: savedPaymentItems }] : []),
          { type: 'quick_replies', options: [
            { id: 'lihat-status', label: 'Lihat status', value: statusUrl, action: 'tool_action' as const },
            { id: 'pesanan-saya', label: 'Pesanan saya', value: '/pesan/saya', action: 'tool_action' as const },
          ] },
        ],
        metadata: { order: result, savedCheckout: true },
      });
    } else if (action === 'request_location' || action === 'send_new_location') {
      await createChatMessage({ chatSessionId, role: 'assistant', content: 'Kakak bisa kirim titik lokasi atau isi alamat manual.', components: [{ type: 'location_picker', mode: 'both' }] });
    } else if (action === 'request_identity') {
      const context = await getCustomerContextForChat(chatSessionId);
      await logAiLearningEvent({ eventType: 'identity_started', chatSessionId, customerId: context.customer?.id, intent: 'identity_verification', metadata: { source: 'request_identity' } });
      if (context.customer) {
        await createChatMessage({
          chatSessionId,
          role: 'assistant',
          content: context.defaultAddress ? 'Kakak sudah terverifikasi. Lanjut pilih pembayaran atau buat order ya.' : 'Kakak sudah terverifikasi. Tinggal lengkapi alamat pengiriman ya.',
          components: context.defaultAddress ? [{ type: 'cart_summary', cartId: (await getChatCart(chatSessionId)).id }] : [{ type: 'location_picker', mode: 'both' }],
        });
      } else {
        await getOrCreateIdentityFlow(chatSessionId);
        await updateIdentityFlow(chatSessionId, { purpose: 'login', step: 'ask_phone_login' });
        await createChatMessage({
          chatSessionId,
          role: 'assistant',
          content: 'Siap kak, verifikasi WhatsApp dulu supaya nama & alamat terisi otomatis. Masukkan nomor WhatsApp yang dipakai sebelumnya ya.',
          components: [{ type: 'quick_replies', options: [{ id: 'idp-nomor', label: 'Pakai nomor ini', value: 'Ketik nomor WA', action: 'send_message' }] }],
        });
      }
    } else if (action === 'checkout_proceed' || action === 'continue_checkout') {
      // Wizard checkout PROGRESIF: hanya tampilkan SATU kartu per langkah.
      // Langkah ditentukan dari state yang sudah ada (cart → identity → alamat → pembayaran),
      // bukan mengirim semua kartu sekaligus.
      const context = await getCustomerContextForChat(chatSessionId);
      const cart = await getChatCart(chatSessionId);
      await logAiLearningEvent({ eventType: 'checkout_started', chatSessionId, customerId: context.customer?.id, intent: 'confirm_order', metadata: { itemCount: cart.itemCount, identified: Boolean(context.customer), hasAddress: Boolean(context.defaultAddress) } });
      let content: string;
      let components: import('@/lib/chat-v3/types').ChatComponent[] = [];
      if (cart.itemCount === 0) {
        content = 'Keranjang kakak masih kosong. Pilih produk dulu ya.';
        components = [{ type: 'quick_replies', options: [{ id: 'lihat-produk2', label: 'Lihat produk', value: 'Lihat produk', action: 'send_message' }, { id: 'rekomendasi2', label: 'Rekomendasi pedas', value: 'Rekomendasi keripik pedas', action: 'send_message' }] }];
      } else if (!context.customer) {
        await getOrCreateIdentityFlow(chatSessionId);
        await updateIdentityFlow(chatSessionId, { purpose: 'login', step: 'ask_phone_login' });
        content = 'Siap kak, verifikasi WhatsApp dulu supaya nama & alamat terisi otomatis. Masukkan nomor WhatsApp yang dipakai sebelumnya ya.';
      } else if (!context.defaultAddress) {
        content = 'Kakak sudah terverifikasi. Sekarang lengkapi alamat pengiriman ya.';
        components = [{ type: 'location_picker', mode: 'both' }];
      } else {
        const methods = await getActivePaymentMethods();
        content = 'Data kakak sudah siap. Pilih metode pembayaran dulu ya.';
        components = [{ type: 'payment_methods', methodIds: methods.map((method) => method.id) }];
      }
      await createChatMessage({ chatSessionId, role: 'assistant', content, components });
    } else if (action === 'use_saved_customer' || action === 'use_saved_address') {
      const context = await getCustomerContextForChat(chatSessionId);
      if (context.customer) await linkChatSessionToCustomer(chatSessionId, context.customer.id);
      if (context.customer && context.defaultAddress) {
        const methods = await getActivePaymentMethods();
        await createChatMessage({
          chatSessionId,
          role: 'assistant',
          content: 'Siap kak, data tersimpan dipakai. Pilih metode pembayaran lalu konfirmasi order ya.',
          components: [{ type: 'payment_methods', methodIds: methods.map((method) => method.id) }],
        });
      } else {
        await createChatMessage({
          chatSessionId,
          role: 'assistant',
          content: context.customer ? 'Siap kak, data customer dipakai. Tinggal lengkapi alamat pengiriman ya.' : 'Kakak perlu verifikasi WhatsApp dulu untuk memuat data tersimpan.',
          components: context.customer ? [{ type: 'location_picker', mode: 'both' }] : [{ type: 'quick_replies', options: [{ id: 'idp-verify2', label: 'Verifikasi WhatsApp', value: 'saya pernah pesan', action: 'send_message' }] }],
        });
      }
    } else if (action === 'edit_customer_data') {
      const context = await getCustomerContextForChat(chatSessionId);
      if (!context.customer) {
        await getOrCreateIdentityFlow(chatSessionId);
        await updateIdentityFlow(chatSessionId, { purpose: 'login', step: 'ask_phone_login' });
        await createChatMessage({
          chatSessionId,
          role: 'assistant',
          content: 'Baik kak, kita verifikasi dulu ya. Masukkan nomor WhatsApp yang dipakai sebelumnya.',
        });
      } else {
        await createChatMessage({
          chatSessionId,
          role: 'assistant',
          content: 'Kakak bisa ubah nama atau nomor WA langsung lewat chat. Tulis data baru yang mau dipakai ya.',
        });
      }
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

    const response = NextResponse.json({ ok: true, statusUrl: orderStatusUrl, messages: await getChatMessages(chatSessionId), cart: await getChatCart(chatSessionId), stage: await getChatV3Stage(chatSessionId) });
    if (orderCookieToken) {
      (await cookies()).set('rk_order_session', orderCookieToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production' && req.headers.get('x-forwarded-proto') === 'https',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Aksi gagal' }, { status: 400 });
  }
}
