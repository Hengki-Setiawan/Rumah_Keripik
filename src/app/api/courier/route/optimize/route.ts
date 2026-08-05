import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, deliveryRoutePoint, transaksi } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { verifyCourierAuth } from '@/lib/courier/auth';
import { nearestNeighbor, twoOpt, routeTotalKm } from '@/lib/courier/routing';

export async function POST(req: Request) {
  try {
    const auth = await verifyCourierAuth(req);
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const today = new Date().toISOString().split('T')[0];
    const pendingDeliveries = await db
      .select({
        id: deliveryAssignment.id,
        idTransaksi: deliveryAssignment.id_transaksi,
        lat: transaksi.lat_pengiriman,
        lng: transaksi.lng_pengiriman,
      })
      .from(deliveryAssignment)
      .leftJoin(transaksi, eq(deliveryAssignment.id_transaksi, transaksi.id_transaksi))
      .where(and(
        eq(deliveryAssignment.kurir_id, auth.courierId),
        sql`date(${deliveryAssignment.created_at}) = ${today}`,
      ))
      .orderBy(deliveryAssignment.created_at);

    if (pendingDeliveries.length === 0) {
      return NextResponse.json({ ok: true, data: { message: 'Tidak ada delivery' } });
    }

    const body = await req.json().catch(() => ({}));
    const startLat = body.currentLat ? Number(body.currentLat) : undefined;
    const startLng = body.currentLng ? Number(body.currentLng) : undefined;

    const waypoints = pendingDeliveries.map((d) => ({
      lat: Number(d.lat) || 0,
      lng: Number(d.lng) || 0,
      sequence: 0,
      deliveryId: d.id,
      idTransaksi: d.idTransaksi,
    }));

    const withCoords = waypoints.filter((w) => w.lat !== 0 && w.lng !== 0);
    const withoutCoords = waypoints.filter((w) => w.lat === 0 && w.lng === 0);

    const optimized = twoOpt(nearestNeighbor(withCoords, startLat, startLng));
    const ordered = [...optimized, ...withoutCoords].map((w, i) => ({ ...w, sequence: i + 1 }));

    await db.delete(deliveryRoutePoint)
      .where(and(eq(deliveryRoutePoint.route_date, today), eq(deliveryRoutePoint.status, 'pending')));

    for (const wp of ordered) {
      await db.insert(deliveryRoutePoint).values({
        route_date: today,
        id_transaksi: wp.idTransaksi,
        sequence_no: wp.sequence,
        lat: String(wp.lat),
        lng: String(wp.lng),
        status: 'pending',
      });
    }

    const totalKm = routeTotalKm(ordered);

    return NextResponse.json({
      ok: true,
      data: { waypoints: ordered, totalStops: ordered.length, totalEstimatedKm: totalKm },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal optimasi rute' }, { status: 500 });
  }
}
