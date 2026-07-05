import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { and, asc, eq, inArray, like, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  customerAddress,
  customerIdentity,
  customerProfile,
  detailTransaksi,
  failedConversation,
  orderEvents,
  orderStatusHistory,
  paymentIntent,
  paymentMethod,
  produk,
  produkKategori,
  produkVarian,
  transaksi,
  webChatMessage,
  webOrderSession,
} from '@/lib/schema';
import { getProductImageUrl } from '@/lib/cloudinary-url';
import { safeJsonParse, safeJsonStringify } from '@/lib/json-utils';
import { parseCart, setCartQuantity, stringifyCart } from '@/lib/public-order/cart';
import { UserEventSchema, type UserEvent } from '@/lib/public-order/schemas';
import type { CartState, ChatUIResponse, OrderState, PublicOrderContext } from '@/lib/public-order/types';
import { generateIdCustomer, generateIdTransaksi, generateKodePesanan, generateOrderStatusToken } from '@/lib/id-generator';
import { formatRupiah, normalizePhoneNumber } from '@/lib/utils';
import { buildPaymentInstructionPayload, generatePaymentIntentId } from '@/lib/payments/payment-utils';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const SESSION_COOKIE = 'rk_order_session';

type HandlerResult = {
  state: OrderState;
  cart: CartState;
  context: PublicOrderContext;
  responses: ChatUIResponse[];
};

export async function POST(req: Request) {
  const rate = checkRateLimit(`public-order-event:${getClientIp(req)}`, 80, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak aksi. Coba lagi sebentar.' }, { status: 429 });

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Session tidak ditemukan' }, { status: 401 });
  }

  const [session] = await db
    .select()
    .from(webOrderSession)
    .where(eq(webOrderSession.anonymous_token, token))
    .limit(1);

  if (!session || session.status !== 'active') {
    return NextResponse.json({ ok: false, error: 'Session tidak aktif' }, { status: 401 });
  }

  const parsed = UserEventSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Event tidak valid' }, { status: 400 });
  }

  await db.insert(webChatMessage).values({
    id_session: session.id_session,
    direction: 'in',
    message_type: parsed.data.type === 'text' ? 'text' : 'system',
    text: describeEvent(parsed.data),
    action_json: JSON.stringify(parsed.data),
  });

  const cart = parseCart(session.cart_json);
  const context = safeJsonParse<PublicOrderContext>(session.context_json, {});
  const result = await handleEvent(parsed.data, cart, context, session.id_session, token);

  await db
    .update(webOrderSession)
    .set({
      current_state: result.state,
      cart_json: stringifyCart(result.cart),
      context_json: safeJsonStringify(result.context),
      last_event_at: sql`(datetime('now', 'utc'))`,
      updated_at: sql`(datetime('now', 'utc'))`,
    })
    .where(eq(webOrderSession.id_session, session.id_session));

  for (const response of result.responses) {
    await db.insert(webChatMessage).values({
      id_session: session.id_session,
      direction: 'out',
      message_type: toStoredMessageType(response.type),
      text: response.message,
      payload_json: JSON.stringify(response),
    });
  }

  await db.insert(orderEvents).values({
    id_transaksi: result.context.order?.idTransaksi,
    no_wa_pelanggan: result.context.customer?.phone ? normalizePhoneNumber(result.context.customer.phone) : `web:${session.id_session}`,
    event_type: toFunnelEvent(parsed.data, result.state),
    event_payload: safeJsonStringify({
      inputType: parsed.data.type,
      state: result.state,
      hasCart: result.cart.items.length > 0,
      itemCount: result.cart.items.length,
    }),
  });

  return NextResponse.json({
    ok: true,
    session: {
      id: session.id_session,
      state: result.state,
    },
    responses: result.responses,
  });
}

async function handleEvent(
  event: UserEvent,
  cart: CartState,
  context: PublicOrderContext,
  sessionId: string,
  anonymousToken: string,
): Promise<HandlerResult> {
  if (event.type === 'button_click') {
    if (event.action === 'show_products') return showProducts(cart, context);
    if (event.action === 'review_cart') return reviewCart(cart, context);
    if (event.action === 'checkout') return { state: 'CUSTOMER_INFO_REQUIRED', cart, context, responses: [buildCustomerInfoForm()] };
    if (event.action === 'confirm_order') return confirmOrder(cart, context, sessionId, anonymousToken);
    if (event.action === 'cancel_order') return cancelOrder();
  }

  if (event.type === 'select_category') return showProducts(cart, context, event.categoryId);
  if (event.type === 'select_product') return selectProduct(cart, context, event.productId);
  if (event.type === 'select_variant') return selectVariant(cart, context, event.productId, event.variantId);
  if (event.type === 'set_quantity') return setQuantity(cart, context, event.productId, event.variantId, event.quantity);
  if (event.type === 'review_cart') return reviewCart(cart, context);

  if (event.type === 'submit_customer_info') {
    return {
      state: 'CUSTOMER_INFO_FILLED',
      cart,
      context: { ...context, customer: event.values },
      responses: [buildAddressForm(event.values)],
    };
  }

  if (event.type === 'submit_address') {
    return {
      state: 'ADDRESS_FILLED',
      cart,
      context: { ...context, address: event.values },
      responses: [await buildPaymentMethodOptions()],
    };
  }

  if (event.type === 'select_payment_method') {
    const [selectedMethod] = await db.select().from(paymentMethod).where(and(eq(paymentMethod.id_payment_method, event.paymentMethodId), eq(paymentMethod.is_active, 1))).limit(1);
    if (!selectedMethod) return { state: 'ADDRESS_FILLED', cart, context, responses: [{ type: 'error', message: 'Metode pembayaran tidak tersedia.' }] };
    return {
      state: 'ORDER_CONFIRMATION',
      cart,
      context: { ...context, paymentMethod: selectedMethod.type, paymentMethodId: selectedMethod.id_payment_method },
      responses: [
        {
          type: 'quick_replies',
          message: 'Data pesanan sudah lengkap. Buat pesanan sekarang?',
          options: [
            { label: 'Buat Pesanan', action: 'confirm_order' },
            { label: 'Lihat Keranjang', action: 'review_cart' },
            { label: 'Batalkan', action: 'cancel_order' },
          ],
        },
      ],
    };
  }

  if (event.type === 'confirm_order') return confirmOrder(cart, context, sessionId, anonymousToken);
  if (event.type === 'cancel_order') return cancelOrder();

  if (event.type === 'text') {
    const parsedText = await handleTextEvent(event.text, cart, context);
    if (parsedText) return parsedText;

    await db.insert(failedConversation).values({
      channel: 'web',
      user_message: event.text,
      current_state: 'BROWSING',
      reason: 'unknown',
    });

    return {
      state: 'BROWSING',
      cart,
      context,
      responses: [
        {
          type: 'quick_replies',
          message: 'Aku belum paham maksudnya. Kamu bisa ketik "produk", "checkout", atau pilih tombol di bawah.',
          options: [
            { label: 'Lihat Produk', action: 'show_products' },
            { label: 'Lihat Keranjang', action: 'review_cart' },
          ],
        },
      ],
    };
  }

  return { state: 'START', cart, context, responses: [{ type: 'error', message: 'Aksi belum didukung.' }] };
}

async function showProducts(cart: CartState, context: PublicOrderContext, categoryId?: string): Promise<HandlerResult> {
  const conditions = categoryId
    ? and(eq(produk.is_active, 1), eq(produk.kategori_id, categoryId))
    : eq(produk.is_active, 1);

  const rows = await db
    .select({
      id: produk.id_produk,
      name: produk.nama_produk,
      description: produk.deskripsi,
      price: produk.harga_jual,
      stock: produk.stok_gudang_utama,
      cloudinaryPublicId: produk.cloudinary_public_id,
      imageUrl: produk.image_url,
      categoryName: produkKategori.nama_kategori,
    })
    .from(produk)
    .leftJoin(produkKategori, eq(produk.kategori_id, produkKategori.id_kategori))
    .where(conditions)
    .orderBy(asc(produk.sort_order), asc(produk.nama_produk))
    .limit(12);

  return {
    state: 'PRODUCT_LIST_SHOWN',
    cart,
    context,
    responses: [
      {
        type: 'product_cards',
        message: rows.length ? 'Pilih produk yang kamu mau.' : 'Belum ada produk aktif di kategori ini.',
        products: rows.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          priceLabel: formatRupiah(item.price),
          stock: item.stock,
          stockLabel: item.stock > 0 ? `${item.stock} tersedia` : 'Stok habis',
          imageUrl: item.cloudinaryPublicId ? getProductImageUrl(item.cloudinaryPublicId) : item.imageUrl,
          categoryName: item.categoryName,
          actions: [{ label: 'Pilih', action: 'select_product', value: item.id }],
        })),
      },
    ],
  };
}

async function handleTextEvent(text: string, cart: CartState, context: PublicOrderContext): Promise<HandlerResult | null> {
  const normalized = text.toLowerCase();
  const cartFromText = await addProductsFromText(normalized, cart, context);
  if (cartFromText) return cartFromText;
  if (/\b(menu|produk|katalog|keripik|harga)\b/.test(normalized)) return showProducts(cart, context);
  const productSearch = await searchProductsFromText(normalized, cart, context);
  if (productSearch) return productSearch;
  if (/\b(keranjang|cart|pesanan saya|ringkasan)\b/.test(normalized)) return reviewCart(cart, context);
  if (/\b(checkout|bayar|lanjut|buat pesanan)\b/.test(normalized)) {
    if (cart.items.length === 0) return reviewCart(cart, context, 'Keranjang masih kosong. Pilih produk dulu ya.');
    return { state: 'CUSTOMER_INFO_REQUIRED', cart, context, responses: [buildCustomerInfoForm()] };
  }
  if (/\b(batal|cancel)\b/.test(normalized)) return cancelOrder();
  return null;
}

async function addProductsFromText(text: string, cart: CartState, context: PublicOrderContext): Promise<HandlerResult | null> {
  if (!/\d/.test(text)) return null;

  const products = await db
    .select({ id: produk.id_produk, name: produk.nama_produk, stock: produk.stok_gudang_utama, price: produk.harga_jual })
    .from(produk)
    .where(eq(produk.is_active, 1))
    .limit(50);
  const variants = await db
    .select({ id: produkVarian.id_varian, productId: produkVarian.id_produk, name: produkVarian.nama_varian, stock: produkVarian.stok, price: produkVarian.harga_jual })
    .from(produkVarian)
    .where(eq(produkVarian.is_active, 1))
    .limit(100);

  let nextCart = cart;
  const matched: string[] = [];

  for (const variant of variants) {
    const qty = extractQuantityForLabel(text, variant.name);
    if (!qty) continue;
    if (variant.stock < qty) return { state: 'PRODUCT_SELECTED', cart, context, responses: [{ type: 'error', message: `Stok ${variant.name} hanya ${variant.stock}.` }] };
    nextCart = setCartQuantity(nextCart, variant.productId, variant.id, qty);
    matched.push(`${qty} ${variant.name}`);
  }

  for (const product of products) {
    if (variants.some((variant) => variant.productId === product.id)) continue;
    const qty = extractQuantityForLabel(text, product.name);
    if (!qty) continue;
    if (product.stock < qty) return { state: 'PRODUCT_SELECTED', cart, context, responses: [{ type: 'error', message: `Stok ${product.name} hanya ${product.stock}.` }] };
    nextCart = setCartQuantity(nextCart, product.id, undefined, qty);
    matched.push(`${qty} ${product.name}`);
  }

  if (!matched.length) return null;
  return reviewCart(nextCart, context, `Aku tambahkan ke keranjang: ${matched.join(', ')}.`);
}

function extractQuantityForLabel(text: string, label: string) {
  const words = label.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((word) => word.length >= 3);
  const keyword = words.find((word) => text.includes(word));
  if (!keyword) return null;

  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const before = text.match(new RegExp(`(\\d+)\\s*(?:pcs|bungkus|pack|x)?\\s+[^,.]{0,30}${escaped}`));
  if (before?.[1]) return Math.max(1, Number(before[1]));
  const after = text.match(new RegExp(`${escaped}[^,.]{0,30}?\\s+(\\d+)\\s*(?:pcs|bungkus|pack|x)?`));
  if (after?.[1]) return Math.max(1, Number(after[1]));
  return null;
}

async function searchProductsFromText(text: string, cart: CartState, context: PublicOrderContext): Promise<HandlerResult | null> {
  const stopWords = new Set(['saya', 'mau', 'beli', 'pesan', 'order', 'dong', 'ya', 'berapa', 'harga', 'keripik', 'kripik', 'pcs', 'bungkus']);
  const keywords = text
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !stopWords.has(word))
    .slice(0, 3);

  if (!keywords.length) return null;

  const rows = await db
    .select({
      id: produk.id_produk,
      name: produk.nama_produk,
      description: produk.deskripsi,
      price: produk.harga_jual,
      stock: produk.stok_gudang_utama,
      cloudinaryPublicId: produk.cloudinary_public_id,
      imageUrl: produk.image_url,
      categoryName: produkKategori.nama_kategori,
    })
    .from(produk)
    .leftJoin(produkKategori, eq(produk.kategori_id, produkKategori.id_kategori))
    .where(and(eq(produk.is_active, 1), like(produk.nama_produk, `%${keywords[0]}%`)))
    .orderBy(asc(produk.sort_order), asc(produk.nama_produk))
    .limit(8);

  if (!rows.length) return null;

  return {
    state: 'PRODUCT_LIST_SHOWN',
    cart,
    context,
    responses: [{
      type: 'product_cards',
      message: `Aku menemukan produk yang mirip dengan "${keywords.join(' ')}". Pilih produk yang sesuai.`,
      products: rows.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        priceLabel: formatRupiah(item.price),
        stock: item.stock,
        stockLabel: item.stock > 0 ? `${item.stock} tersedia` : 'Stok habis',
        imageUrl: item.cloudinaryPublicId ? getProductImageUrl(item.cloudinaryPublicId) : item.imageUrl,
        categoryName: item.categoryName,
        actions: [{ label: 'Pilih', action: 'select_product', value: item.id }],
      })),
    }],
  };
}

async function selectProduct(cart: CartState, context: PublicOrderContext, productId: string): Promise<HandlerResult> {
  const [product] = await db.select().from(produk).where(and(eq(produk.id_produk, productId), eq(produk.is_active, 1))).limit(1);
  if (!product) return { state: 'PRODUCT_LIST_SHOWN', cart, context, responses: [{ type: 'error', message: 'Produk tidak ditemukan atau tidak aktif.' }] };

  const variants = await db
    .select()
    .from(produkVarian)
    .where(and(eq(produkVarian.id_produk, productId), eq(produkVarian.is_active, 1)))
    .orderBy(asc(produkVarian.sort_order), asc(produkVarian.nama_varian));

  if (variants.length > 0) {
    return {
      state: 'PRODUCT_SELECTED',
      cart,
      context,
      responses: [
        {
          type: 'variant_picker',
          message: `Pilih varian untuk ${product.nama_produk}.`,
          productId,
          variants: variants.map((variant) => ({
            id: variant.id_varian,
            label: variant.nama_varian,
            price: variant.harga_jual,
            priceLabel: formatRupiah(variant.harga_jual),
            stock: variant.stok,
            disabled: variant.stok <= 0,
          })),
        },
      ],
    };
  }

  return {
    state: 'PRODUCT_SELECTED',
    cart,
    context,
    responses: [
      {
        type: 'quantity_picker',
        message: `Mau berapa ${product.nama_produk}?`,
        productId,
        min: 1,
        max: Math.max(product.stok_gudang_utama, 1),
        value: 1,
      },
    ],
  };
}

async function selectVariant(cart: CartState, context: PublicOrderContext, productId: string, variantId: string): Promise<HandlerResult> {
  const [variant] = await db
    .select()
    .from(produkVarian)
    .where(and(eq(produkVarian.id_produk, productId), eq(produkVarian.id_varian, variantId), eq(produkVarian.is_active, 1)))
    .limit(1);

  if (!variant) return { state: 'PRODUCT_SELECTED', cart, context, responses: [{ type: 'error', message: 'Varian tidak ditemukan atau tidak aktif.' }] };

  return {
    state: 'VARIANT_SELECTED',
    cart,
    context,
    responses: [
      {
        type: 'quantity_picker',
        message: `Mau berapa ${variant.nama_varian}?`,
        productId,
        variantId,
        min: 1,
        max: Math.max(variant.stok, 1),
        value: 1,
      },
    ],
  };
}

async function setQuantity(cart: CartState, context: PublicOrderContext, productId: string, variantId: string | undefined, quantity: number) {
  const maxStock = await getMaxStock(productId, variantId);
  if (maxStock <= 0) return { state: 'PRODUCT_SELECTED' as const, cart, context, responses: [{ type: 'error' as const, message: 'Stok produk ini habis.' }] };
  if (quantity > maxStock) return { state: 'PRODUCT_SELECTED' as const, cart, context, responses: [{ type: 'error' as const, message: `Stok hanya tersedia ${maxStock}.` }] };

  const nextCart = setCartQuantity(cart, productId, variantId, quantity);
  return reviewCart(nextCart, context, 'Produk sudah masuk keranjang.');
}

async function reviewCart(cart: CartState, context: PublicOrderContext, message = 'Ringkasan keranjang kamu.'): Promise<HandlerResult> {
  if (cart.items.length === 0) {
    return {
      state: 'CART_REVIEW',
      cart,
      context,
      responses: [{ type: 'quick_replies', message: 'Keranjang masih kosong.', options: [{ label: 'Lihat Produk', action: 'show_products' }] }],
    };
  }

  const productIds = [...new Set(cart.items.map((item) => item.productId))];
  const variantIds = cart.items.map((item) => item.variantId).filter((value): value is string => Boolean(value));
  const productRows = await db.select().from(produk).where(inArray(produk.id_produk, productIds));
  const variantRows = variantIds.length ? await db.select().from(produkVarian).where(inArray(produkVarian.id_varian, variantIds)) : [];

  const items = cart.items.map((item) => {
    const product = productRows.find((row) => row.id_produk === item.productId);
    const variant = variantRows.find((row) => row.id_varian === item.variantId);
    const unitPrice = variant?.harga_jual ?? product?.harga_jual ?? 0;
    return {
      productId: item.productId,
      variantId: item.variantId,
      name: product?.nama_produk ?? 'Produk',
      variantLabel: variant?.nama_varian,
      quantity: item.quantity,
      unitPrice,
      subtotal: unitPrice * item.quantity,
    };
  });
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    state: 'CART_REVIEW',
    cart,
    context,
    responses: [
      {
        type: 'cart_summary',
        message,
        items,
        subtotal,
        subtotalLabel: formatRupiah(subtotal),
        actions: [
          { label: 'Checkout', action: 'checkout' },
          { label: 'Tambah Produk', action: 'show_products' },
          { label: 'Batalkan', action: 'cancel_order' },
        ],
      },
    ],
  };
}

async function confirmOrder(cart: CartState, context: PublicOrderContext, sessionId: string, anonymousToken: string): Promise<HandlerResult> {
  if (context.order) {
    return {
      state: 'PAYMENT_INSTRUCTION_SHOWN',
      cart,
      context,
      responses: [buildPaymentInstruction(context.order.idTransaksi, context.order.kodePesanan, context.order.totalBayar, context.paymentMethod || 'bank_transfer')],
    };
  }

  if (cart.items.length === 0) return { state: 'CART_REVIEW', cart, context, responses: [{ type: 'error', message: 'Keranjang masih kosong.' }] };
  if (!context.customer || !context.address || !context.paymentMethod) {
    return { state: 'CUSTOMER_INFO_REQUIRED', cart, context, responses: [{ type: 'error', message: 'Data pelanggan, alamat, atau metode pembayaran belum lengkap.' }] };
  }

  const normalizedPhone = normalizePhoneNumber(context.customer.phone);
  const idCustomer = generateIdCustomer();
  const idTransaksi = await generateIdTransaksi();
  const kodePesanan = generateKodePesanan();
  const statusToken = generateOrderStatusToken();

  const result = await db.transaction(async (tx) => {
    const productIds = [...new Set(cart.items.map((item) => item.productId))];
    const variantIds = cart.items.map((item) => item.variantId).filter((value): value is string => Boolean(value));
    const productRows = await tx.select().from(produk).where(and(inArray(produk.id_produk, productIds), eq(produk.is_active, 1)));
    const variantRows = variantIds.length
      ? await tx.select().from(produkVarian).where(and(inArray(produkVarian.id_varian, variantIds), eq(produkVarian.is_active, 1)))
      : [];

    let totalBayar = 0;
    const details = cart.items.map((item) => {
      const product = productRows.find((row) => row.id_produk === item.productId);
      const variant = variantRows.find((row) => row.id_varian === item.variantId);
      if (!product) throw new Error(`Produk ${item.productId} tidak tersedia`);

      const stock = variant?.stok ?? product.stok_gudang_utama;
      if (stock < item.quantity) throw new Error(`Stok ${product.nama_produk} tidak cukup`);

      const unitPrice = variant?.harga_jual ?? product.harga_jual;
      const subtotal = unitPrice * item.quantity;
      totalBayar += subtotal;
      return { item, product, variant, unitPrice, subtotal };
    });

    const [selectedMethod] = context.paymentMethodId
      ? await tx.select().from(paymentMethod).where(and(eq(paymentMethod.id_payment_method, context.paymentMethodId), eq(paymentMethod.is_active, 1))).limit(1)
      : [];
    if (!selectedMethod) throw new Error('Metode pembayaran tidak tersedia');
    const instructionPayload = selectedMethod
      ? buildPaymentInstructionPayload(selectedMethod)
      : { type: context.paymentMethod!, label: fallbackPaymentLabel(context.paymentMethod!), note: 'Metode pembayaran belum dikonfigurasi admin.' };

    await tx.insert(customerProfile).values({
      id_customer: idCustomer,
      nama: context.customer!.name,
      phone: normalizedPhone,
      tags_json: JSON.stringify(['web-order']),
    });

    await tx.insert(customerIdentity).values({
      id_customer: idCustomer,
      provider: 'web',
      external_id: anonymousToken,
    });

    const addressResult = await tx
      .insert(customerAddress)
      .values({
        id_customer: idCustomer,
        recipient_name: context.address!.recipientName,
        phone: normalizePhoneNumber(context.address!.phone),
        address_text: context.address!.addressText,
        latitude: context.address!.latitude != null ? String(context.address!.latitude) : null,
        longitude: context.address!.longitude != null ? String(context.address!.longitude) : null,
        location_source: context.address!.latitude != null && context.address!.longitude != null ? 'gps' : 'manual',
        landmark: context.address!.landmark ?? null,
        courier_note: context.address!.courierNote ?? null,
        is_default: 1,
      })
      .returning({ id_address: customerAddress.id_address });

    await tx.insert(transaksi).values({
      id_transaksi: idTransaksi,
      id_customer: idCustomer,
      id_session: sessionId,
      id_address: addressResult[0]?.id_address,
      tipe_penjualan: 'Online_Web',
      total_bayar: totalBayar,
      status_pembayaran: context.paymentMethod === 'cod' ? 'Menunggu_Verifikasi' : 'Menunggu_Bayar',
      kode_pesanan: kodePesanan,
      status_token: statusToken,
      catatan: `Order public web. Metode: ${context.paymentMethod}`,
      nama_penerima: context.address!.recipientName,
      alamat_penerima: context.address!.addressText,
      no_hp_penerima: normalizePhoneNumber(context.address!.phone),
      sumber_order: 'WA',
      lat_pengiriman: context.address!.latitude != null ? String(context.address!.latitude) : null,
      lng_pengiriman: context.address!.longitude != null ? String(context.address!.longitude) : null,
      order_status: 'awaiting_payment',
      payment_status: context.paymentMethod === 'cod' ? 'cod_requested' : 'payment_instruction_shown',
      payment_method: context.paymentMethod,
      shipping_address_snapshot: safeJsonStringify(context.address),
    });

    for (const detail of details) {
      await tx.insert(detailTransaksi).values({
        id_transaksi: idTransaksi,
        id_produk: detail.product.id_produk,
        id_varian: detail.variant?.id_varian,
        qty_terjual: detail.item.quantity,
        harga_snapshot: detail.unitPrice,
        nama_produk_snapshot: detail.product.nama_produk,
        nama_varian_snapshot: detail.variant?.nama_varian,
        berat_gram_snapshot: detail.variant?.berat_gram ?? detail.product.berat_gram,
        subtotal: detail.subtotal,
      });
    }

    await tx.insert(orderEvents).values({
      id_transaksi: idTransaksi,
      no_wa_pelanggan: normalizedPhone,
      event_type: 'WEB_ORDER_CREATED',
      event_payload: safeJsonStringify({ kodePesanan, totalBayar, paymentMethod: context.paymentMethod }),
    });

    await tx.insert(paymentIntent).values({
      id_payment_intent: generatePaymentIntentId(),
      id_transaksi: idTransaksi,
      id_payment_method: selectedMethod.id_payment_method,
      method_type: context.paymentMethod!,
      amount_due: totalBayar,
      status: 'instruction_shown',
      instruction_json: safeJsonStringify(instructionPayload),
    });

    await tx.insert(orderStatusHistory).values({
      id_transaksi: idTransaksi,
      order_status: 'awaiting_payment',
      payment_status: context.paymentMethod === 'cod' ? 'cod_requested' : 'payment_instruction_shown',
      event_type: 'ORDER_CREATED',
      actor: 'customer',
      metadata_json: safeJsonStringify({ kodePesanan, paymentMethod: context.paymentMethod }),
    });

    return { totalBayar, instructionPayload, statusToken };
  });

  const nextContext = { ...context, order: { idTransaksi, kodePesanan, totalBayar: result.totalBayar, statusToken: result.statusToken } };
  return {
    state: 'PAYMENT_INSTRUCTION_SHOWN',
    cart,
    context: nextContext,
    responses: [buildPaymentInstruction(idTransaksi, kodePesanan, result.totalBayar, context.paymentMethod, result.instructionPayload)],
  };
}

async function getMaxStock(productId: string, variantId?: string) {
  if (variantId) {
    const [variant] = await db.select({ stock: produkVarian.stok }).from(produkVarian).where(eq(produkVarian.id_varian, variantId)).limit(1);
    return variant?.stock ?? 0;
  }

  const [product] = await db.select({ stock: produk.stok_gudang_utama }).from(produk).where(eq(produk.id_produk, productId)).limit(1);
  return product?.stock ?? 0;
}

function buildCustomerInfoForm(): ChatUIResponse {
  return {
    type: 'customer_info_form',
    message: 'Isi nama dan nomor WhatsApp/HP untuk lanjut checkout.',
    fields: [
      { name: 'name', label: 'Nama', inputType: 'text', required: true },
      { name: 'phone', label: 'Nomor HP/WA', inputType: 'tel', required: true },
    ],
    submitLabel: 'Lanjut Isi Alamat',
  };
}

function buildAddressForm(customer: { name: string; phone: string }): ChatUIResponse {
  return {
    type: 'address_form',
    message: 'Isi alamat pengiriman. Koordinat bisa ditambahkan nanti dari map/GPS.',
    fields: [
      { name: 'recipientName', label: 'Nama penerima', inputType: 'text', required: true },
      { name: 'phone', label: 'Nomor penerima', inputType: 'tel', required: true },
      { name: 'addressText', label: 'Alamat lengkap', inputType: 'textarea', required: true },
      { name: 'landmark', label: 'Patokan', inputType: 'text', required: false },
      { name: 'courierNote', label: 'Catatan kurir', inputType: 'text', required: false },
    ],
    submitLabel: `Lanjut Pembayaran untuk ${customer.name}`,
  };
}

async function buildPaymentMethodOptions(): Promise<ChatUIResponse> {
  const methods = await db.select().from(paymentMethod).where(eq(paymentMethod.is_active, 1)).orderBy(asc(paymentMethod.sort_order), asc(paymentMethod.label));
  return {
    type: 'quick_replies',
    message: methods.length ? 'Pilih metode pembayaran.' : 'Belum ada metode pembayaran aktif. Hubungi admin.',
    options: methods.map((method) => ({ label: method.label, action: 'select_payment_method', value: method.id_payment_method })),
  };
}

function buildPaymentInstruction(
  orderId: string,
  orderCode: string,
  amount: number,
  method: 'bank_transfer' | 'qris' | 'ewallet' | 'cod',
  instruction?: { type: string; label: string; note?: string; accountName?: string; accountNumber?: string; bankName?: string; qrisImageUrl?: string },
): ChatUIResponse {
  return {
    type: 'payment_instruction',
    message: method === 'cod'
      ? 'Pesanan COD dibuat dan menunggu konfirmasi admin.'
      : 'Pesanan dibuat. Silakan bayar sesuai nominal, lalu upload bukti pembayaran pada tahap berikutnya.',
    orderId,
    orderCode,
    amount,
    amountLabel: formatRupiah(amount),
    paymentMethods: [{
      type: method,
      label: instruction?.label || fallbackPaymentLabel(method),
      note: buildInstructionNote(instruction),
    }],
    actions: [
      { label: 'Upload Bukti Bayar', action: 'upload_payment_proof', value: orderId },
      { label: 'Tanya Admin', action: 'ask_admin' },
    ],
  };
}

function fallbackPaymentLabel(method: 'bank_transfer' | 'qris' | 'ewallet' | 'cod') {
  return method === 'bank_transfer' ? 'Transfer Bank' : method === 'qris' ? 'QRIS Statis' : method === 'ewallet' ? 'E-Wallet' : 'COD';
}

function toFunnelEvent(event: UserEvent, state: OrderState) {
  if (event.type === 'button_click' && event.action === 'show_products') return 'WEB_PRODUCTS_REQUESTED';
  if (event.type === 'select_category') return 'WEB_CATEGORY_SELECTED';
  if (event.type === 'select_product') return 'WEB_PRODUCT_SELECTED';
  if (event.type === 'select_variant') return 'WEB_VARIANT_SELECTED';
  if (event.type === 'set_quantity') return 'WEB_CART_UPDATED';
  if (event.type === 'review_cart') return 'WEB_CART_REVIEWED';
  if (event.type === 'button_click' && event.action === 'checkout') return 'WEB_CHECKOUT_STARTED';
  if (event.type === 'submit_customer_info') return 'WEB_CUSTOMER_INFO_SUBMITTED';
  if (event.type === 'submit_address') return 'WEB_ADDRESS_SUBMITTED';
  if (event.type === 'select_payment_method') return 'WEB_PAYMENT_METHOD_SELECTED';
  if (event.type === 'confirm_order' || (event.type === 'button_click' && event.action === 'confirm_order')) return 'WEB_ORDER_CONFIRMED';
  if (event.type === 'cancel_order' || (event.type === 'button_click' && event.action === 'cancel_order')) return 'WEB_ORDER_CANCELLED';
  if (event.type === 'text') return 'WEB_TEXT_MESSAGE_SENT';
  return `WEB_STATE_${state}`;
}

function buildInstructionNote(instruction?: { note?: string; accountName?: string; accountNumber?: string; bankName?: string; qrisImageUrl?: string }) {
  if (!instruction) return 'Metode pembayaran belum dikonfigurasi admin.';
  const parts = [instruction.bankName, instruction.accountNumber, instruction.accountName, instruction.qrisImageUrl ? `QRIS: ${instruction.qrisImageUrl}` : null, instruction.note].filter(Boolean);
  return parts.join(' | ') || undefined;
}

function cancelOrder(): HandlerResult {
  return {
    state: 'CANCELLED',
    cart: { items: [] },
    context: {},
    responses: [{ type: 'text', message: 'Pesanan dibatalkan. Kamu bisa mulai lagi dengan pilih Lihat Produk.' }],
  };
}

function describeEvent(event: UserEvent) {
  if (event.type === 'text') return event.text;
  if ('action' in event) return `${event.type}:${event.action}`;
  return event.type;
}

function toStoredMessageType(responseType: ChatUIResponse['type']) {
  if (responseType === 'error') return 'text';
  if (responseType === 'variant_picker' || responseType === 'quantity_picker' || responseType === 'customer_info_form' || responseType === 'address_form') return 'form';
  if (responseType === 'cart_summary') return 'confirmation';
  if (responseType === 'payment_instruction') return 'payment_upload';
  return responseType;
}
