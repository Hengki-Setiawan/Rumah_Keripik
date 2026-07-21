import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, transaksi } from '@/lib/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';

export async function GET() {
  try {
    await requireAdminRole('order:update');

    const pending = await db
      .select({
        id_transaksi: transaksi.id_transaksi,
        kode_pesanan: transaksi.kode_pesanan,
        nama_penerima: transaksi.nama_penerima,
        alamat_penerima: transaksi.alamat_penerima,
        no_hp_penerima: transaksi.no_hp_penerima,
        order_status: transaksi.order_status,
        created_at: transaksi.waktu_simpan,
      })
      .from(transaksi)
      .leftJoin(deliveryAssignment, eq(transaksi.id_transaksi, deliveryAssignment.id_transaksi))
      .where(
        and(
          eq(transaksi.order_status, 'shipping'),
          isNull(deliveryAssignment.id),
          sql`${transaksi.lat_pengiriman} IS NOT NULL`
        )
      )
      .orderBy(sql`${transaksi.waktu_simpan} DESC`);

    return NextResponse.json({ ok: true, deliveries: pending });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[ADMIN_PENDING_DELIVERIES]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
