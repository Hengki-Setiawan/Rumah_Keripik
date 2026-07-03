import { NextResponse } from 'next/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  detailTransaksi,
  lokasiPelanggan,
  orderEvents,
  pelangganChatbot,
  produk,
  transaksi,
} from '@/lib/schema';
import { generateIdTransaksi, generateKodePesanan } from '@/lib/id-generator';
import { normalizePhoneNumber } from '@/lib/utils';

export const runtime = 'nodejs';

const OrderItemSchema = z.object({
  id_produk: z.string().min(1),
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
  paymentMethod: z.enum(['transfer', 'cod']),
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

      const productMap = new Map(productRows.map((item) => [item.id_produk, item]));
      let totalBayar = 0;
      const details: Array<{
        id_produk: string;
        qty_terjual: number;
        harga_snapshot: number;
        subtotal: number;
      }> = [];

      for (const item of payload.items) {
        const product = productMap.get(item.id_produk);
        if (!product) {
          throw new Error(`Produk ${item.id_produk} tidak ditemukan atau tidak aktif`);
        }
        if (product.stok_gudang_utama < item.qty) {
          throw new Error(`Stok ${product.nama_produk} tidak cukup. Tersedia ${product.stok_gudang_utama}`);
        }

        const subtotal = product.harga_jual * item.qty;
        totalBayar += subtotal;
        details.push({
          id_produk: item.id_produk,
          qty_terjual: item.qty,
          harga_snapshot: product.harga_jual,
          subtotal,
        });
      }

      const idTransaksi = await generateIdTransaksi();
      const kodePesanan = generateKodePesanan();
      const statusPembayaran = payload.paymentMethod === 'transfer' ? 'Menunggu_Bayar' : 'Menunggu_Verifikasi';
      const metode = payload.paymentMethod === 'transfer' ? 'Transfer' : 'COD';
      const catatan = [
        `Order web (${payload.source})`,
        `Metode: ${metode}`,
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

      await tx.insert(transaksi).values({
        id_transaksi: idTransaksi,
        no_wa_pelanggan: customerId,
        tipe_penjualan: 'Online_WA',
        total_bayar: totalBayar,
        status_pembayaran: statusPembayaran,
        kode_pesanan: kodePesanan,
        catatan,
        nama_penerima: payload.customer.name,
        alamat_penerima: payload.address.text,
        no_hp_penerima: normalizedPhone,
        sumber_order: payload.source === 'telegram' ? 'Telegram' : 'WA',
        lat_pengiriman: lat,
        lng_pengiriman: lng,
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
          payment_method: payload.paymentMethod,
          total_bayar: totalBayar,
          item_count: details.length,
        }),
      });

      await tx.insert(orderEvents).values({
        no_wa_pelanggan: customerId,
        id_transaksi: idTransaksi,
        event_type: payload.paymentMethod === 'transfer' ? 'MENUNGGU_PEMBAYARAN' : 'MENUNGGU_KONFIRMASI_ADMIN',
        event_payload: JSON.stringify({ status_pembayaran: statusPembayaran }),
      });

      return { idTransaksi, kodePesanan, totalBayar, statusPembayaran };
    });

    return NextResponse.json({ ok: true, order: result });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.errors[0]?.message || 'Data pesanan belum lengkap'
      : error instanceof Error
        ? error.message
        : 'Gagal membuat pesanan';

    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
