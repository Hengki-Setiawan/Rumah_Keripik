import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, deliveryRoutePoint, transaksi, couriers } from '@/lib/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';

export async function GET(req: Request) {
  try {
    await requireAdminRole('courier:manage');

    const url = new URL(req.url);
    const courierId = url.searchParams.get('courierId');
    const routeDate = url.searchParams.get('routeDate');
    const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);

    const conditions = [];
    if (courierId) conditions.push(eq(deliveryAssignment.kurir_id, parseInt(courierId)));
    if (routeDate) conditions.push(eq(deliveryRoutePoint.route_date, routeDate));

    const rows = await db
      .select({
        assignmentId: deliveryAssignment.id,
        id_transaksi: deliveryAssignment.id_transaksi,
        kurir_id: deliveryAssignment.kurir_id,
        kurir_name: deliveryAssignment.kurir_name,
        status: deliveryAssignment.status,
        pickup_at: deliveryAssignment.pickup_at,
        delivered_at: deliveryAssignment.delivered_at,
        kode_pesanan: transaksi.kode_pesanan,
        nama_penerima: transaksi.nama_penerima,
        alamat_penerima: transaksi.alamat_penerima,
        route_date: deliveryRoutePoint.route_date,
        sequence_no: deliveryRoutePoint.sequence_no,
        stop_status: deliveryRoutePoint.status,
        created_at: deliveryAssignment.created_at,
      })
      .from(deliveryAssignment)
      .leftJoin(transaksi, eq(deliveryAssignment.id_transaksi, transaksi.id_transaksi))
      .leftJoin(deliveryRoutePoint, eq(deliveryRoutePoint.id_transaksi, deliveryAssignment.id_transaksi))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(sql`${deliveryRoutePoint.route_date} DESC`, deliveryRoutePoint.sequence_no)
      .limit(limit);

    return NextResponse.json({ ok: true, routes: rows });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[ADMIN_ROUTES]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}