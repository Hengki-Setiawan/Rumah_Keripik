import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { detailTransaksi, orderEvents, produk, transaksi } from '@/lib/schema';
import { normalizePhoneNumber } from '@/lib/utils';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

function maskPhone(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 4) return value;
  return `${digits.slice(0, 4)}****${digits.slice(-2)}`;
}

export async function GET(req: Request) {
  const rate = checkRateLimit(`order-track:${getClientIp(req)}`, 30, 60_000);
  if (!rate.ok) {
    return NextResponse.json({ ok: false, error: 'Terlalu banyak percobaan cek status. Coba lagi sebentar.' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code')?.trim();
  const token = searchParams.get('token')?.trim();
  const phone = searchParams.get('phone')?.trim();

  if (!code) {
    return NextResponse.json({ ok: false, error: 'Kode pesanan wajib diisi' }, { status: 400 });
  }
  if (!token && !phone) {
    return NextResponse.json({ ok: false, error: 'Token status atau nomor HP wajib diisi' }, { status: 403 });
  }

  const [order] = await db
    .select()
    .from(transaksi)
    .where(eq(transaksi.kode_pesanan, code))
    .limit(1);

  if (!order) {
    return NextResponse.json({ ok: false, error: 'Pesanan tidak ditemukan' }, { status: 404 });
  }

  const normalizedPhone = phone ? normalizePhoneNumber(phone) : null;
  const tokenMatches = Boolean(order.status_token && token && token === order.status_token);
  const phoneMatches = Boolean(
    normalizedPhone &&
    [order.no_hp_penerima, order.no_wa_pelanggan]
      .filter(Boolean)
      .map((value) => normalizePhoneNumber(value as string))
      .includes(normalizedPhone)
  );

  if (!tokenMatches && !phoneMatches) {
    return NextResponse.json({ ok: false, error: 'Verifikasi pesanan tidak valid' }, { status: 403 });
  }

  const items = await db
    .select({
      id_produk: detailTransaksi.id_produk,
      nama_produk: produk.nama_produk,
      qty: detailTransaksi.qty_terjual,
      harga: detailTransaksi.harga_snapshot,
      subtotal: detailTransaksi.subtotal,
    })
    .from(detailTransaksi)
    .leftJoin(produk, eq(detailTransaksi.id_produk, produk.id_produk))
    .where(eq(detailTransaksi.id_transaksi, order.id_transaksi));

  const events = await db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.id_transaksi, order.id_transaksi));

  return NextResponse.json({
    ok: true,
    order: {
      id_transaksi: order.id_transaksi,
      kode_pesanan: order.kode_pesanan,
      total_bayar: order.total_bayar,
      status_pembayaran: order.status_pembayaran,
      order_status: order.order_status,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      nama_penerima: order.nama_penerima,
      no_hp_penerima: maskPhone(order.no_hp_penerima),
      alamat_penerima: order.alamat_penerima,
      waktu_simpan: order.waktu_simpan,
      updated_at: order.updated_at,
    },
    items,
    events,
  });
}
