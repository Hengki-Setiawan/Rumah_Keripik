import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  chatCartItems,
  chatCarts,
  chatSessions,
  customerAddress,
  customerSessions,
  detailTransaksi,
  lokasiPelanggan,
  orderEvents,
  orderStatusHistory,
  pelangganChatbot,
  paymentIntent,
  paymentMethod,
  produk,
  produkVarian,
  transaksi,
  webOrderSession,
} from '@/lib/schema';
import { generateAnonymousToken, generateIdTransaksi, generateIdWebSession, generateKodePesanan, generateOrderStatusToken } from '@/lib/id-generator';
import { normalizePhoneNumber } from '@/lib/utils';
import { buildPaymentInstructionPayload, generatePaymentIntentId } from '@/lib/payments/payment-utils';
import { resolveCustomerByPhone } from '@/lib/customer-resolver';
import { setupOrderPaymentAfterCreate } from '@/lib/payments/order-payment-setup';

export type CreateChatOrderInput = {
  chatSessionId: string;
  customer: {
    name: string;
    phone: string;
    type?: 'konsumen' | 'warung' | 'reseller';
  };
  address: {
    text: string;
    note?: string;
    mapsLink?: string;
    lat?: string;
    lng?: string;
  };
  paymentMethodId: string;
  notes?: string;
};

function parseCoordinate(value?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  return /^-?\d+(\.\d+)?$/.test(trimmed) ? trimmed : null;
}

export async function createOrderFromChatCart(input: CreateChatOrderInput) {
  const customerType = input.customer.type || 'konsumen';
  const normalizedPhone = normalizePhoneNumber(input.customer.phone);
  const customerId = normalizedPhone;
  const lat = parseCoordinate(input.address.lat);
  const lng = parseCoordinate(input.address.lng);

  const result = await db.transaction(async (tx) => {
    const [cart] = await tx
      .select()
      .from(chatCarts)
      .where(and(eq(chatCarts.chatSessionId, input.chatSessionId), eq(chatCarts.status, 'active')))
      .limit(1);
    if (!cart) throw new Error('Keranjang chat tidak ditemukan');

    const cartItems = await tx.select().from(chatCartItems).where(eq(chatCartItems.cartId, cart.id));
    if (cartItems.length === 0) throw new Error('Keranjang masih kosong');

    const productIds = [...new Set(cartItems.map((item) => item.productId))];
    const variantIds = cartItems.map((item) => item.variantId).filter((value): value is string => Boolean(value));
    const productRows = await tx.select().from(produk).where(and(inArray(produk.id_produk, productIds), eq(produk.is_active, 1)));
    const variantRows = variantIds.length
      ? await tx.select().from(produkVarian).where(and(inArray(produkVarian.id_varian, variantIds), eq(produkVarian.is_active, 1)))
      : [];

    const productMap = new Map(productRows.map((item) => [item.id_produk, item]));
    const variantMap = new Map(variantRows.map((item) => [item.id_varian, item]));
    let totalBayar = 0;
    const details: Array<{
      id_produk: string;
      id_varian?: string | null;
      qty_terjual: number;
      harga_snapshot: number;
      nama_produk_snapshot: string;
      nama_varian_snapshot?: string | null;
      berat_gram_snapshot?: number | null;
      subtotal: number;
    }> = [];

    for (const item of cartItems) {
      const product = productMap.get(item.productId);
      if (!product) throw new Error(`Produk ${item.productId} tidak tersedia`);
      const variant = item.variantId ? variantMap.get(item.variantId) : null;
      if (item.variantId && (!variant || variant.id_produk !== item.productId)) throw new Error(`Varian ${item.variantId} tidak tersedia`);
      const stock = variant ? variant.stok : product.stok_gudang_utama;
      const unitPrice = variant ? variant.harga_jual : product.harga_jual;
      if (stock < item.quantity) throw new Error(`Stok ${variant?.nama_varian || product.nama_produk} tidak cukup. Tersedia ${stock}`);
      const subtotal = unitPrice * item.quantity;
      totalBayar += subtotal;
      details.push({
        id_produk: item.productId,
        id_varian: item.variantId,
        qty_terjual: item.quantity,
        harga_snapshot: unitPrice,
        nama_produk_snapshot: product.nama_produk,
        nama_varian_snapshot: variant?.nama_varian ?? null,
        berat_gram_snapshot: variant?.berat_gram ?? product.berat_gram,
        subtotal,
      });
    }

    const [configuredMethod] = await tx
      .select()
      .from(paymentMethod)
      .where(and(eq(paymentMethod.id_payment_method, input.paymentMethodId), eq(paymentMethod.is_active, 1)))
      .limit(1);
    if (!configuredMethod) throw new Error('Metode pembayaran tidak tersedia');
    if (configuredMethod.min_order_total != null && totalBayar < configuredMethod.min_order_total) throw new Error(`${configuredMethod.label} minimal ${configuredMethod.min_order_total.toLocaleString('id-ID')}`);
    if (configuredMethod.max_order_total != null && totalBayar > configuredMethod.max_order_total) throw new Error(`${configuredMethod.label} maksimal ${configuredMethod.max_order_total.toLocaleString('id-ID')}`);

    const methodType = configuredMethod.type;
    const isCod = methodType === 'cod';
    const statusPembayaran = isCod ? 'Menunggu_Verifikasi' : 'Menunggu_Bayar';
    const paymentStatus = isCod ? 'cod_requested' : 'payment_instruction_shown';
    const orderStatus = isCod ? 'awaiting_admin_confirmation' : 'awaiting_payment';
    const idSession = generateIdWebSession();
    const kodePesanan = generateKodePesanan();
    const idTransaksi = await generateIdTransaksi();
    const statusToken = generateOrderStatusToken();
    const anonymousToken = generateAnonymousToken();
    const instruction = buildPaymentInstructionPayload(configuredMethod);
    const catatan = [
      'Order web chat V3',
      `Chat session: ${input.chatSessionId}`,
      `Metode: ${configuredMethod.label}`,
      customerType !== 'konsumen' ? `Tipe pelanggan: ${customerType}` : null,
      input.address.mapsLink ? `Maps: ${input.address.mapsLink}` : null,
      input.address.note ? `Patokan: ${input.address.note}` : null,
      input.notes ? `Catatan: ${input.notes}` : null,
    ].filter(Boolean).join('\n');

    await tx.insert(pelangganChatbot).values({
      no_wa_pelanggan: customerId,
      nama_pelanggan: input.customer.name,
      alamat_pengiriman: input.address.text,
      channel: 'wa',
      tags: JSON.stringify([customerType, 'web-chat-v3']),
      terakhir_aktif: sql`(datetime('now', 'utc'))`,
    }).onConflictDoUpdate({
      target: pelangganChatbot.no_wa_pelanggan,
      set: {
        nama_pelanggan: input.customer.name,
        alamat_pengiriman: input.address.text,
        channel: 'wa',
        tags: JSON.stringify([customerType, 'web-chat-v3']),
        terakhir_aktif: sql`(datetime('now', 'utc'))`,
      },
    });

    const customer = await resolveCustomerByPhone(tx, {
      name: input.customer.name,
      phone: normalizedPhone,
      source: 'web',
      notes: customerType !== 'konsumen' ? `Tipe pelanggan: ${customerType}` : null,
      tags: [customerType, 'web-chat-v3'],
    });

    const [addressRow] = await tx.insert(customerAddress).values({
      id_customer: customer.idCustomer,
      label: 'Alamat utama',
      recipient_name: input.customer.name,
      phone: normalizedPhone,
      address_text: input.address.text,
      latitude: lat,
      longitude: lng,
      location_source: lat && lng ? (input.address.mapsLink ? 'map_picker' : 'gps') : 'manual',
      landmark: input.address.mapsLink || null,
      courier_note: input.address.note || null,
      is_default: 1,
      last_used_at: sql`(datetime('now', 'utc'))`,
    }).returning({ id_address: customerAddress.id_address });

    await tx.insert(webOrderSession).values({
      id_session: idSession,
      anonymous_token: anonymousToken,
      id_customer: customer.idCustomer,
      current_state: 'ORDER_CREATED_FROM_CHAT_V3',
      cart_json: JSON.stringify({ items: cartItems.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity })) }),
      context_json: JSON.stringify({ source: 'web-chat-v3', chatSessionId: input.chatSessionId, kodePesanan }),
      status: 'completed',
    });

    await tx.insert(transaksi).values({
      id_transaksi: idTransaksi,
      no_wa_pelanggan: customerId,
      id_customer: customer.idCustomer,
      id_session: idSession,
      id_address: addressRow?.id_address,
      tipe_penjualan: 'Online_Web',
      total_bayar: totalBayar,
      status_pembayaran: statusPembayaran,
      kode_pesanan: kodePesanan,
      status_token: statusToken,
      catatan,
      nama_penerima: input.customer.name,
      alamat_penerima: input.address.text,
      no_hp_penerima: normalizedPhone,
      sumber_order: 'Offline',
      lat_pengiriman: lat,
      lng_pengiriman: lng,
      order_status: orderStatus,
      payment_status: paymentStatus,
      payment_method: methodType,
      shipping_address_snapshot: JSON.stringify({ ...input.address, recipientName: input.customer.name, phone: normalizedPhone }),
      shipping_location_json: lat && lng ? JSON.stringify({ lat, lng, source: input.address.mapsLink ? 'maps_link' : 'gps' }) : null,
    });

    for (const detail of details) await tx.insert(detailTransaksi).values({ id_transaksi: idTransaksi, ...detail });

    if (lat && lng) {
      await tx.insert(lokasiPelanggan).values({
        no_wa_pelanggan: customerId,
        lat,
        lng,
        alamat_teks: input.address.text,
        source: input.address.mapsLink ? 'maps_link' : 'manual',
        is_verified: 0,
        id_transaksi: idTransaksi,
        catatan: input.address.note || null,
      });
    }

    await tx.insert(orderEvents).values({
      no_wa_pelanggan: customerId,
      id_transaksi: idTransaksi,
      event_type: 'CHAT_V3_ORDER_CREATED',
      event_payload: JSON.stringify({ kode_pesanan: kodePesanan, chat_session_id: input.chatSessionId, payment_method: configuredMethod.id_payment_method, total_bayar: totalBayar, item_count: details.length }),
    });
    await tx.insert(orderEvents).values({
      no_wa_pelanggan: customerId,
      id_transaksi: idTransaksi,
      event_type: isCod ? 'MENUNGGU_KONFIRMASI_ADMIN' : 'MENUNGGU_PEMBAYARAN',
      event_payload: JSON.stringify({ status_pembayaran: statusPembayaran }),
    });

    await tx.insert(paymentIntent).values({
      id_payment_intent: generatePaymentIntentId(),
      id_transaksi: idTransaksi,
      id_payment_method: configuredMethod.id_payment_method,
      method_type: methodType,
      amount_due: totalBayar,
      status: isCod ? 'awaiting_admin_verification' : 'instruction_shown',
      instruction_json: JSON.stringify(instruction),
    });

    await tx.insert(orderStatusHistory).values({
      id_transaksi: idTransaksi,
      order_status: orderStatus,
      payment_status: paymentStatus,
      event_type: 'CHAT_V3_ORDER_CREATED',
      actor: 'customer',
      metadata_json: JSON.stringify({ kodePesanan, idSession, idCustomer: customer.idCustomer, chatSessionId: input.chatSessionId, paymentMethodId: configuredMethod.id_payment_method, paymentMethod: methodType }),
    });

    await tx.update(chatCarts).set({ status: 'converted', customerId: customer.idCustomer, updatedAt: sql`(datetime('now', 'utc'))` }).where(eq(chatCarts.id, cart.id));
    await tx.update(chatSessions).set({ customerId: customer.idCustomer, activeOrderId: idTransaksi, updatedAt: sql`(datetime('now', 'utc'))` }).where(eq(chatSessions.id, input.chatSessionId));
    const [updatedSession] = await tx.select().from(chatSessions).where(eq(chatSessions.id, input.chatSessionId)).limit(1);
    if (updatedSession) {
      await tx.update(customerSessions).set({ customerId: customer.idCustomer, lastSeenAt: sql`(datetime('now', 'utc'))` }).where(eq(customerSessions.id, updatedSession.customerSessionId));
    }

    return {
      idTransaksi,
      kodePesanan,
      totalBayar,
      statusPembayaran,
      statusToken,
      anonymousToken,
      paymentMethod: methodType,
      paymentLabel: configuredMethod.label,
      customerId: customer.idCustomer,
      productIds,
      chatSessionId: input.chatSessionId,
      customer: {
        name: input.customer.name,
        phone: normalizedPhone,
        address: input.address.text,
      },
      method: configuredMethod,
      items: details.map((detail) => ({
        name: detail.nama_varian_snapshot ? `${detail.nama_produk_snapshot} - ${detail.nama_varian_snapshot}` : detail.nama_produk_snapshot,
        price: detail.harga_snapshot,
        quantity: detail.qty_terjual,
      })),
    };
  });

  const paymentSetup = await setupOrderPaymentAfterCreate({
    idTransaksi: result.idTransaksi,
    kodePesanan: result.kodePesanan,
    totalBayar: result.totalBayar,
    statusToken: result.statusToken,
    customer: result.customer,
    method: result.method,
    items: result.items,
  });

  return {
    idTransaksi: result.idTransaksi,
    kodePesanan: result.kodePesanan,
    totalBayar: result.totalBayar,
    statusPembayaran: result.statusPembayaran,
    statusToken: result.statusToken,
    anonymousToken: result.anonymousToken,
    paymentMethod: result.paymentMethod,
    paymentLabel: result.paymentLabel,
    customerId: result.customerId,
    productIds: result.productIds,
    chatSessionId: result.chatSessionId,
    checkoutUrl: paymentSetup.checkoutUrl,
    paymentInstruction: paymentSetup.instruction,
    paymentProvider: paymentSetup.provider,
  };
}
