import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { transaksi } from '@/lib/schema';
import { verifyBearerAuth } from '@/lib/auth-jwt';

export async function GET(req: Request) {
  const auth = await verifyBearerAuth(req);
  if (!auth.authenticated || !auth.payload) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const phone = auth.payload.sub;

  const orders = await db
    .select({
      idTransaksi: transaksi.id_transaksi,
      kodePesanan: transaksi.kode_pesanan,
      totalBayar: transaksi.total_bayar,
      statusPembayaran: transaksi.status_pembayaran,
      paymentStatus: transaksi.payment_status,
      orderStatus: transaksi.order_status,
      paymentMethod: transaksi.payment_method,
      namaPenerima: transaksi.nama_penerima,
      waktuSimpan: transaksi.waktu_simpan,
    })
    .from(transaksi)
    .where(eq(transaksi.no_wa_pelanggan, phone))
    .orderBy(desc(transaksi.waktu_simpan))
    .limit(50);

  return NextResponse.json({ ok: true, orders });
}
