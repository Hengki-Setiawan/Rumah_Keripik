import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, transaksi, deliveryRoutePoint } from '@/lib/schema';
import { requireCourierAuth } from '@/lib/courier-auth';
import { eq, and } from 'drizzle-orm';

const GUDANG_LAT = -0.5022;
const GUDANG_LNG = 117.1536;

export async function GET(request: Request) {
  try {
    const courier = await requireCourierAuth(request);
    if (!courier) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date().toISOString().slice(0, 10);

    const deliveries = await db
      .select({
        id_transaksi: deliveryAssignment.id_transaksi,
        lat: transaksi.lat_pengiriman,
        lng: transaksi.lng_pengiriman,
        address: transaksi.alamat_penerima,
        sequence_no: deliveryRoutePoint.sequence_no,
      })
      .from(deliveryAssignment)
      .innerJoin(transaksi, eq(deliveryAssignment.id_transaksi, transaksi.id_transaksi))
      .leftJoin(
        deliveryRoutePoint,
        and(
          eq(deliveryRoutePoint.id_transaksi, deliveryAssignment.id_transaksi),
          eq(deliveryRoutePoint.route_date, today)
        )
      )
      .where(
        and(
          eq(deliveryAssignment.kurir_id, courier.id),
          eq(deliveryAssignment.status, 'Siap_Dikirim')
        )
      )
      .orderBy(deliveryRoutePoint.sequence_no);

    const waypoints = [
      {
        lat: GUDANG_LAT,
        lng: GUDANG_LNG,
        name: 'Gudang',
        type: 'start' as const,
      },
      ...deliveries
        .filter((d) => d.lat && d.lng)
        .map((d) => ({
          lat: parseFloat(d.lat!),
          lng: parseFloat(d.lng!),
          name: d.address || `Order ${d.id_transaksi}`,
          type: 'destination' as const,
          id_transaksi: d.id_transaksi,
        })),
    ];

    return NextResponse.json({
      ok: true,
      waypoints,
      total_deliveries: deliveries.length,
    });
  } catch (error) {
    console.error('[COURIER_ROUTE_TODAY]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
