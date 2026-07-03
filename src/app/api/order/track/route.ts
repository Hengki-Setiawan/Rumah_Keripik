import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { detailTransaksi, orderEvents, produk, transaksi } from '@/lib/schema';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code')?.trim();

  if (!code) {
    return NextResponse.json({ ok: false, error: 'Kode pesanan wajib diisi' }, { status: 400 });
  }

  const [order] = await db
    .select()
    .from(transaksi)
    .where(eq(transaksi.kode_pesanan, code))
    .limit(1);

  if (!order) {
    return NextResponse.json({ ok: false, error: 'Pesanan tidak ditemukan' }, { status: 404 });
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
    order,
    items,
    events,
  });
}
