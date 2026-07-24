import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { createChatMessage } from '@/lib/chat-v3/messages';
import { getCustomerContextForChat, linkChatSessionToCustomer } from '@/lib/chat-v3/customer-context';
import { getActivePaymentMethods } from './tools/payment';
import { addToChatCart, getChatCart, updateChatCartItem, removeChatCartItem } from './tools/cart';
import { recommendProducts, searchProducts } from './tools/products';
import { customerAddress, lokasiPelanggan, paymentIntent, paymentMethod, pelangganChatbot, transaksi, detailTransaksi, produk } from '@/lib/schema';
import { searchKnowledgeBase } from '@/lib/knowledge/retrieval';
import { resolveCustomerByPhone } from '@/lib/customer-resolver';
import { normalizePhoneNumber } from '@/lib/utils';
import { buildPaymentInstructionPayload, generatePaymentIntentId } from '@/lib/payments/payment-utils';
import { createOrderFromChatCart } from '@/lib/orders/create-chat-order';

export async function runChatTool(chatSessionId: string, toolName: string, args: Record<string, unknown> = {}) {
  switch (toolName) {
    case 'searchProducts':
    case 'search_products':
      return searchProducts(String(args.query || ''), Array.isArray(args.productIds) ? args.productIds.map(String) : undefined);
    case 'recommendProducts':
    case 'recommend_products':
      return recommendProducts(String(args.message || args.query || ''));
    case 'addToCart':
    case 'add_to_cart':
      return addToChatCart(chatSessionId, String(args.productId || args.product_id || ''), args.variantId || args.variant_id ? String(args.variantId || args.variant_id) : undefined, Number(args.quantity || 1));
    case 'updateCartItem':
    case 'update_cart_item':
      return updateChatCartItem(chatSessionId, String(args.itemId || args.item_id || ''), Number(args.quantity || 0));
    case 'getCart':
    case 'get_cart':
      return getChatCart(chatSessionId);
    case 'getPaymentMethods':
    case 'get_payment_methods':
      return getActivePaymentMethods();
    case 'check_customer_session':
    case 'get_customer_profile':
    case 'get_customer_addresses':
      return getCustomerContextForChat(chatSessionId);
    case 'find_or_create_customer':
    case 'findOrCreateCustomer':
      return findOrCreateCustomerTool(chatSessionId, args);
    case 'save_customer_address':
    case 'saveCustomerAddress':
      return saveCustomerAddressTool(chatSessionId, args);
    case 'save_location':
    case 'saveLocation':
      return saveLocationTool(chatSessionId, args);
    case 'create_order_from_cart':
    case 'createOrderFromCart':
      return createOrderFromChatCart({
        chatSessionId,
        customer: {
          name: String(args.name || args.customerName || args.recipientName || ''),
          phone: String(args.phone || args.whatsapp || ''),
          type: normalizeCustomerType(args.type),
        },
        address: {
          text: String(args.address || args.addressText || ''),
          note: args.note ? String(args.note) : undefined,
          mapsLink: args.mapsLink ? String(args.mapsLink) : undefined,
          lat: args.lat ? String(args.lat) : undefined,
          lng: args.lng ? String(args.lng) : undefined,
        },
        paymentMethodId: String(args.paymentMethodId || args.methodId || ''),
        notes: args.notes ? String(args.notes) : undefined,
      });
    case 'select_payment_method':
    case 'selectPaymentMethod':
      return selectPaymentMethodTool(chatSessionId, args);
    case 'create_payment_instruction':
    case 'createPaymentInstruction':
      return createPaymentInstructionTool(args);
    case 'get_order_status': {
      const orderId = String(args.orderId || args.order_id || '');
      if (!orderId) return null;
      const [order] = await db.select().from(transaksi).where(eq(transaksi.id_transaksi, orderId)).limit(1);
      return order;
    }
    case 'search_knowledge_base':
      return searchKnowledgeBase({ query: String(args.query || args.question || ''), topK: Number(args.topK || args.top_k || 3) });
    case 'requestAdminHandoff':
    case 'request_admin_handoff':
      await createChatMessage({
        chatSessionId,
        role: 'system',
        content: 'Chat ini ditandai butuh bantuan admin.',
        components: [{ type: 'admin_handoff_card', reason: String(args.reason || 'Butuh bantuan admin') }],
      });
      return { ok: true };
    case 'remove_from_cart':
    case 'removeFromCart':
      return removeChatCartItem(chatSessionId, String(args.itemId || args.item_id || ''));
    case 'get_order_history':
    case 'getOrderHistory':
      return getOrderHistoryTool(chatSessionId, args);
    case 'suggest_alternative_product':
    case 'suggestAlternativeProduct':
      return suggestAlternativeProductTool(args);
    case 'identify_product_from_image':
    case 'identifyProductFromImage':
      return identifyProductFromImageTool(args);
    default:
      throw new Error(`Tool ${toolName} belum tersedia`);
  }
}

async function findOrCreateCustomerTool(chatSessionId: string, args: Record<string, unknown>) {
  const name = String(args.name || args.customerName || '').trim();
  const phone = String(args.phone || args.whatsapp || '').trim();
  if (name.length < 2 || phone.length < 8) throw new Error('Nama dan nomor WA customer wajib diisi');

  const customer = await resolveCustomerByPhone(db, { name, phone, source: 'web', tags: ['web-chat-v3'] });
  await linkChatSessionToCustomer(chatSessionId, customer.idCustomer);
  return { id: customer.idCustomer, phone: customer.phone, isNew: customer.isNew };
}

async function saveCustomerAddressTool(chatSessionId: string, args: Record<string, unknown>) {
  const context = await getCustomerContextForChat(chatSessionId);
  if (!context.customer) throw new Error('Customer belum terhubung');
  const addressText = String(args.address || args.addressText || '').trim();
  if (addressText.length < 8) throw new Error('Alamat belum lengkap');

  const [address] = await db.insert(customerAddress).values({
    id_customer: context.customer.id,
    label: String(args.label || 'Alamat utama'),
    recipient_name: args.recipientName ? String(args.recipientName) : context.customer.name,
    phone: normalizePhoneNumber(String(args.phone || '')) || null,
    address_text: addressText,
    latitude: args.lat ? String(args.lat) : null,
    longitude: args.lng ? String(args.lng) : null,
    location_source: args.lat && args.lng ? 'map_picker' : 'manual',
    landmark: args.landmark || args.mapsLink ? String(args.landmark || args.mapsLink) : null,
    courier_note: args.note ? String(args.note) : null,
    is_default: args.isDefault === false ? 0 : 1,
  }).returning();
  return address;
}

async function saveLocationTool(chatSessionId: string, args: Record<string, unknown>) {
  const context = await getCustomerContextForChat(chatSessionId);
  const phone = String(args.phone || '').trim();
  const noWa = phone ? normalizePhoneNumber(phone) : context.customer?.id;
  const lat = String(args.lat || '').trim();
  const lng = String(args.lng || '').trim();
  if (!noWa || !lat || !lng) throw new Error('Nomor WA, latitude, dan longitude wajib diisi');

  await db.insert(pelangganChatbot).values({
    no_wa_pelanggan: noWa,
    nama_pelanggan: context.customer?.name || null,
    channel: 'wa',
    terakhir_aktif: new Date().toISOString(),
  }).onConflictDoNothing();

  const [location] = await db.insert(lokasiPelanggan).values({
    no_wa_pelanggan: noWa,
    lat,
    lng,
    alamat_teks: args.address ? String(args.address) : null,
    source: args.source === 'maps_link' ? 'maps_link' : 'manual',
    catatan: args.note ? String(args.note) : null,
  }).returning();
  return location;
}

async function selectPaymentMethodTool(chatSessionId: string, args: Record<string, unknown>) {
  const methodId = String(args.paymentMethodId || args.methodId || '').trim();
  const [method] = await db.select().from(paymentMethod).where(eq(paymentMethod.id_payment_method, methodId)).limit(1);
  if (!method || method.is_active !== 1) throw new Error('Metode pembayaran tidak tersedia');
  await createChatMessage({
    chatSessionId,
    role: 'assistant',
    content: 'Metode pembayaran sudah dipilih. Aku siapkan ringkasan order ya kak.',
    components: [{ type: 'order_summary', orderDraftId: chatSessionId, paymentMethodId: method.id_payment_method }],
    metadata: { paymentMethodId: method.id_payment_method },
  });
  return { id: method.id_payment_method, ...buildPaymentInstructionPayload(method) };
}

async function createPaymentInstructionTool(args: Record<string, unknown>) {
  const orderId = String(args.orderId || args.order_id || '').trim();
  if (!orderId) throw new Error('Order ID wajib diisi');
  const [order] = await db.select().from(transaksi).where(eq(transaksi.id_transaksi, orderId)).limit(1);
  if (!order) throw new Error('Order tidak ditemukan');
  const [method] = await db.select().from(paymentMethod).where(eq(paymentMethod.id_payment_method, String(args.paymentMethodId || args.methodId || order.payment_method || ''))).limit(1);
  if (!method || method.is_active !== 1) throw new Error('Metode pembayaran tidak tersedia');

  const instruction = buildPaymentInstructionPayload(method);
  await db.insert(paymentIntent).values({
    id_payment_intent: generatePaymentIntentId(),
    id_transaksi: orderId,
    id_payment_method: method.id_payment_method,
    method_type: method.type,
    amount_due: order.total_bayar,
    status: method.type === 'cod' ? 'awaiting_admin_verification' : 'instruction_shown',
    instruction_json: JSON.stringify(instruction),
  }).onConflictDoNothing();
  return { orderId, amountDue: order.total_bayar, instruction };
}

async function getOrderHistoryTool(chatSessionId: string, args: Record<string, unknown>) {
  const context = await getCustomerContextForChat(chatSessionId);
  if (!context.customer) throw new Error('Customer belum terhubung');
  const limit = Math.min(Math.max(1, Number(args.limit || 5)), 20);
  const orders = await db
    .select({ id_transaksi: transaksi.id_transaksi, kode_pesanan: transaksi.kode_pesanan, total_bayar: transaksi.total_bayar, status: transaksi.order_status, tgl_transaksi: transaksi.waktu_simpan, payment_status: transaksi.payment_status })
    .from(transaksi)
    .where(and(eq(transaksi.id_customer, context.customer.id), sql`${transaksi.order_status} != 'cancelled'`))
    .orderBy(desc(transaksi.waktu_simpan))
    .limit(limit);
  return orders;
}

async function suggestAlternativeProductTool(args: Record<string, unknown>) {
  const productId = String(args.originalProductId || '');
  if (!productId) throw new Error('ID produk wajib diisi');
  const [product] = await db.select({ kategori: produk.kategori_id }).from(produk).where(eq(produk.id_produk, productId)).limit(1);
  if (!product) throw new Error('Produk tidak ditemukan');
  if (!product.kategori) return [];
  const alternatives = await db
    .select({ id_produk: produk.id_produk, nama_produk: produk.nama_produk, harga_jual: produk.harga_jual, stok: produk.stok_gudang_utama })
    .from(produk)
    .where(and(eq(produk.kategori_id, product.kategori), eq(produk.is_active, 1), sql`${produk.id_produk} != ${productId}`, sql`${produk.stok_gudang_utama} > 0`))
    .limit(5);
  return alternatives;
}

function identifyProductFromImageTool(args: Record<string, unknown>) {
  const imageUrl = String(args.imageUrl || '');
  if (!imageUrl) throw new Error('URL gambar wajib diisi');
  return {
    note: 'Identifikasi gambar akan diproses. Hasil sementara: produk mungkin dikenali setelah analisis.',
    imageUrl,
    confidence: 'pending',
  };
}

function normalizeCustomerType(value: unknown): 'konsumen' | 'warung' | 'reseller' {
  return value === 'warung' || value === 'reseller' ? value : 'konsumen';
}
