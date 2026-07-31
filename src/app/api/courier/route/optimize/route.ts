import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, deliveryRoutePoint, transaksi } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { verifyCourierAuth } from '@/lib/courier/auth';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestNeighbor<T extends { lat: number; lng: number }>(
  points: T[],
  startLat?: number,
  startLng?: number
): T[] {
  if (points.length <= 1) return points;

  const unvisited = [...points];
  const ordered: T[] = [];
  let currentLat = startLat ?? points[0].lat;
  let currentLng = startLng ?? points[0].lng;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const d = haversineKm(currentLat, currentLng, unvisited[i].lat, unvisited[i].lng);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    const next = unvisited.splice(nearestIdx, 1)[0];
    ordered.push(next);
    currentLat = next.lat;
    currentLng = next.lng;
  }

  return ordered;
}

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

    const optimized = nearestNeighbor(withCoords, startLat, startLng);
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

    const totalKm = ordered.length > 1
      ? Math.round(ordered.slice(0, -1).reduce((sum, wp, i) =>
        sum + haversineKm(wp.lat, wp.lng, ordered[i + 1].lat, ordered[i + 1].lng), 0
      ) * 10) / 10
      : 0;

    return NextResponse.json({
      ok: true,
      data: { waypoints: ordered, totalStops: ordered.length, totalEstimatedKm: totalKm },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal optimasi rute' }, { status: 500 });
  }
}
