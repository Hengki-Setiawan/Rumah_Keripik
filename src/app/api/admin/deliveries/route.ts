import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, couriers, transaksi } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';

export async function GET() {
  try {
    await requireAdminRole('order:update');

    const result = await db
      .select({
        id: deliveryAssignment.id,
        idTransaksi: deliveryAssignment.id_transaksi,
        status: deliveryAssignment.status,
        kurirId: deliveryAssignment.kurir_id,
        kurirName: deliveryAssignment.kurir_name,
        customerName: transaksi.nama_penerima,
        customerAddress: transaksi.alamat_penerima,
        customerPhone: transaksi.no_hp_penerima,
        createdAt: deliveryAssignment.created_at,
        lat: transaksi.lat_pengiriman,
        lng: transaksi.lng_pengiriman,
      })
      .from(deliveryAssignment)
      .leftJoin(transaksi, eq(deliveryAssignment.id_transaksi, transaksi.id_transaksi))
      .orderBy(sql`${deliveryAssignment.created_at} DESC`);

    return NextResponse.json({ ok: true, data: result });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
