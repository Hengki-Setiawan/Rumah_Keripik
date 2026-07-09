import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  customerAddress,
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
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { resolveCustomerByPhone } from '@/lib/customer-resolver';

export const runtime = 'nodejs';

const OrderItemSchema = z.object({
  id_produk: z.string().min(1),
  id_varian: z.string().min(1).optional(),
  qty: z.number().int().min(1).max(99),
});

const WebOrderSchema = z.object({
  source: z.enum(['web', 'telegram']).default('web'),
  chatId: z.string().optional(),
  customer: z.object({
    name: z.string().min(2).max(80),
    phone: z.string().min(8).max(24),
    type: z.enum(['konsumen', 'warung', 'reseller']).default('konsumen'),
  }),
  address: z.object({
    text: z.string().min(8).max(500),
    note: z.string().max(240).optional(),
    mapsLink: z.string().max(500).optional(),
    lat: z.string().max(40).optional(),
    lng: z.string().max(40).optional(),
  }),
  paymentMethodId: z.string().min(1),
  notes: z.string().max(360).optional(),
  items: z.array(OrderItemSchema).min(1).max(20),
});

function parseCoordinate(value?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  return /^-?\d+(\.\d+)?$/.test(trimmed) ? trimmed : null;
}

function buildCustomerId(source: 'web' | 'telegram', chatId: string | undefined, phone: string) {
  if (source === 'telegram' && chatId) return `tg_${chatId.replace(/^tg_/, '')}`;
  return normalizePhoneNumber(phone);
}

export async function POST(req: Request) {
  try {
    const rate = await checkRateLimit(`order-web:${getClientIp(req)}`, 10, 60_000);
    if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak percobaan order. Coba lagi sebentar.' }, { status: 429 });
    const payload = WebOrderSchema.parse(await req.json());
    const normalizedPhone = normalizePhoneNumber(payload.customer.phone);
    const customerId = buildCustomerId(payload.source, payload.chatId, normalizedPhone);
    const channel = customerId.startsWith('tg_') ? 'telegram' : 'wa';
    const lat = parseCoordinate(payload.address.lat);
    const lng = parseCoordinate(payload.address.lng);
    const ids = [...new Set(payload.items.map((item) => item.id_produk))];

    const result = await db.transaction(async (tx) => {
      const productRows = await tx
        .select()
        .from(produk)
        .where(and(inArray(produk.id_produk, ids), eq(produk.is_active, 1)));
      const variantIds = payload.items.map((item) => item.id_varian).filter((value): value is string => Boolean(value));
      const variantRows = variantIds.length
        ? await tx.select().from(produkVarian).where(and(inArray(produkVarian.id_varian, variantIds), eq(produkVarian.is_active, 1)))
        : [];

      const productMap = new Map(productRows.map((item) => [item.id_produk, item]));
      const variantMap = new Map(variantRows.map((item) => [item.id_varian, item]));
      let totalBayar = 0;
      const details: Array<{
        id_produk: string;
        id_varian?: string;
        qty_terjual: number;
        harga_snapshot: number;
        nama_produk_snapshot: string;
        nama_varian_snapshot?: string | null;
        berat_gram_snapshot?: number | null;
        subtotal: number;
      }> = [];

      for (const item of payload.items) {
        const product = productMap.get(item.id_produk);
        if (!product) {
          throw new Error(`Produk ${item.id_produk} tidak ditemukan atau tidak aktif`);
        }
        const variant = item.id_varian ? variantMap.get(item.id_varian) : null;
        if (item.id_varian && (!variant || variant.id_produk !== item.id_produk)) {
          throw new Error(`Varian ${item.id_varian} tidak tersedia`);
        }
        const stock = variant ? variant.stok : product.stok_gudang_utama;
        const unitPrice = variant ? variant.harga_jual : product.harga_jual;
        if (stock < item.qty) throw new Error(`Stok ${variant?.nama_varian || product.nama_produk} tidak cukup. Tersedia ${stock}`);

        const subtotal = unitPrice * item.qty;
        totalBayar += subtotal;
        details.push({
          id_produk: item.id_produk,
          id_varian: item.id_varian,
          qty_terjual: item.qty,
          harga_snapshot: unitPrice,
          nama_produk_snapshot: product.nama_produk,
          nama_varian_snapshot: variant?.nama_varian ?? null,
          berat_gram_snapshot: variant?.berat_gram ?? product.berat_gram,
          subtotal,
        });
      }

      const idSession = generateIdWebSession();
      const kodePesanan = generateKodePesanan();
      const idTransaksi = await generateIdTransaksi();
      const statusToken = generateOrderStatusToken();
      const anonymousToken = generateAnonymousToken();
      const [configuredMethod] = await tx
        .select()
        .from(paymentMethod)
        .where(and(eq(paymentMethod.id_payment_method, payload.paymentMethodId), eq(paymentMethod.is_active, 1)))
        .limit(1);
      if (!configuredMethod) throw new Error('Metode pembayaran tidak tersedia');

      const methodType = configuredMethod.type;
      const isCod = methodType === 'cod';
      const statusPembayaran = isCod ? 'Menunggu_Verifikasi' : 'Menunggu_Bayar';
      const paymentStatus = isCod ? 'cod_requested' : 'payment_instruction_shown';
      const orderStatus = isCod ? 'awaiting_admin_confirmation' : 'awaiting_payment';
      if (configuredMethod?.min_order_total != null && totalBayar < configuredMethod.min_order_total) {
        throw new Error(`${configuredMethod.label} minimal ${configuredMethod.min_order_total.toLocaleString('id-ID')}`);
      }
      if (configuredMethod?.max_order_total != null && totalBayar > configuredMethod.max_order_total) {
        throw new Error(`${configuredMethod.label} maksimal ${configuredMethod.max_order_total.toLocaleString('id-ID')}`);
      }
      const instruction = buildPaymentInstructionPayload(configuredMethod);
      const catatan = [
        `Order web (${payload.source})`,
        `Metode: ${configuredMethod.label}`,
        payload.customer.type !== 'konsumen' ? `Tipe pelanggan: ${payload.customer.type}` : null,
        payload.address.mapsLink ? `Maps: ${payload.address.mapsLink}` : null,
        payload.address.note ? `Patokan: ${payload.address.note}` : null,
        payload.notes ? `Catatan: ${payload.notes}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      await tx
        .insert(pelangganChatbot)
        .values({
          no_wa_pelanggan: customerId,
          nama_pelanggan: payload.customer.name,
          alamat_pengiriman: payload.address.text,
          channel,
          tags: JSON.stringify([payload.customer.type, 'web-order']),
          terakhir_aktif: sql`(datetime('now', 'utc'))`,
        })
        .onConflictDoUpdate({
          target: pelangganChatbot.no_wa_pelanggan,
          set: {
            nama_pelanggan: payload.customer.name,
            alamat_pengiriman: payload.address.text,
            channel,
            tags: JSON.stringify([payload.customer.type, 'web-order']),
            terakhir_aktif: sql`(datetime('now', 'utc'))`,
          },
        });

      const customer = await resolveCustomerByPhone(tx, {
        name: payload.customer.name,
        phone: payload.customer.phone,
        source: payload.source,
        chatId: payload.chatId,
        notes: payload.customer.type !== 'konsumen' ? `Tipe pelanggan: ${payload.customer.type}` : null,
        tags: [payload.customer.type, 'web-order'],
      });

      const [addressRow] = await tx.insert(customerAddress).values({
        id_customer: customer.idCustomer,
        label: 'Alamat utama',
        recipient_name: payload.customer.name,
        phone: normalizedPhone,
        address_text: payload.address.text,
        latitude: lat,
        longitude: lng,
        location_source: lat && lng ? (payload.address.mapsLink ? 'map_picker' : 'gps') : 'manual',
        landmark: payload.address.mapsLink || null,
        courier_note: payload.address.note || null,
        is_default: 1,
        last_used_at: sql`(datetime('now', 'utc'))`,
      }).returning({ id_address: customerAddress.id_address });

      await tx.insert(webOrderSession).values({
        id_session: idSession,
        anonymous_token: anonymousToken,
        id_customer: customer.idCustomer,
        current_state: 'ORDER_CREATED',
        cart_json: JSON.stringify({ items: payload.items.map((item) => ({ productId: item.id_produk, variantId: item.id_varian, quantity: item.qty })) }),
        context_json: JSON.stringify({ source: payload.source, chatId: payload.chatId, kodePesanan }),
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
        nama_penerima: payload.customer.name,
        alamat_penerima: payload.address.text,
        no_hp_penerima: normalizedPhone,
        sumber_order: payload.source === 'telegram' ? 'Telegram' : 'WA',
        lat_pengiriman: lat,
        lng_pengiriman: lng,
        order_status: orderStatus,
        payment_status: paymentStatus,
        payment_method: methodType,
        shipping_address_snapshot: JSON.stringify({ ...payload.address, recipientName: payload.customer.name, phone: normalizedPhone }),
        shipping_location_json: lat && lng ? JSON.stringify({ lat, lng, source: payload.address.mapsLink ? 'maps_link' : 'gps' }) : null,
      });

      for (const detail of details) {
        await tx.insert(detailTransaksi).values({
          id_transaksi: idTransaksi,
          ...detail,
        });
      }

      if (lat && lng) {
        await tx.insert(lokasiPelanggan).values({
          no_wa_pelanggan: customerId,
          lat,
          lng,
          alamat_teks: payload.address.text,
          source: payload.address.mapsLink ? 'maps_link' : 'manual',
          is_verified: 0,
          id_transaksi: idTransaksi,
          catatan: payload.address.note || null,
        });
      }

      await tx.insert(orderEvents).values({
        no_wa_pelanggan: customerId,
        id_transaksi: idTransaksi,
        event_type: 'WEB_ORDER_CREATED',
        event_payload: JSON.stringify({
          kode_pesanan: kodePesanan,
          payment_method: configuredMethod.id_payment_method,
          payment_method_type: methodType,
          total_bayar: totalBayar,
          item_count: details.length,
        }),
      });

      await tx.insert(orderEvents).values({
        no_wa_pelanggan: customerId,
        id_transaksi: idTransaksi,
        event_type: isCod ? 'MENUNGGU_KONFIRMASI_ADMIN' : 'MENUNGGU_PEMBAYARAN',
        event_payload: JSON.stringify({ status_pembayaran: statusPembayaran }),
      });

      const idPaymentIntent = generatePaymentIntentId();
      await tx.insert(paymentIntent).values({
        id_payment_intent: idPaymentIntent,
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
        event_type: 'WEB_ORDER_CREATED',
        actor: 'customer',
        metadata_json: JSON.stringify({ kodePesanan, idSession, idCustomer: customer.idCustomer, paymentMethodId: configuredMethod.id_payment_method, paymentMethod: methodType }),
      });

      return { idTransaksi, kodePesanan, totalBayar, statusPembayaran, statusToken, anonymousToken };
    });

    const response = NextResponse.json({ ok: true, order: result });
    (await cookies()).set('rk_order_session', result.anonymousToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.errors[0]?.message || 'Data pesanan belum lengkap'
      : error instanceof Error
        ? error.message
        : 'Gagal membuat pesanan';

    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
