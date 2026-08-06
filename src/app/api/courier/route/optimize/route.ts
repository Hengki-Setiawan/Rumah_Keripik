import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, deliveryRoutePoint, transaksi } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { verifyCourierAuth } from '@/lib/courier/auth';
import { nearestNeighbor, twoOpt, orOpt, routeTotalKm } from '@/lib/courier/routing';

const WAREHOUSE_LAT = -5.134;
const WAREHOUSE_LNG = 119.4135;

interface LatLng { lat: number; lng: number; }

interface OsrmTripResult {
  order: number[];          // waypoint_index (trip pos) -> input index (0 = start)
  polyline: LatLng[];       // real road geometry
  distanceM: number;
  durationS: number;
}

async function tryOsrmTrip(coords: LatLng[]): Promise<OsrmTripResult | null> {
  if (coords.length < 2) return null;
  const servers = [
    'https://router.project-osrm.org',
    'https://routing.openstreetmap.de/routed-car',
  ];
  for (const base of servers) {
    try {
      const path = coords.map((c) => `${c.lng},${c.lat}`).join(';');
      const url = `${base}/trip/v1/driving/${path}?roundtrip=false&source=first&destination=any&geometries=geojson&overview=full&steps=false`;
      const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
      if (!res.ok) continue;
      const json = await res.json();
      if (json.code !== 'Ok' || !Array.isArray(json.waypoints) || !Array.isArray(json.trips)) continue;
      const trip = json.trips[0];
      if (!trip) continue;

      // OSRM mengembalikan waypoints dalam urutan input; tiap entry punya
      // waypoint_index = posisi di trip. Bangun order[inputIndex] = tripPos.
      const tripPosOfInput: number[] = json.waypoints.map((wp: { waypoint_index?: number }) => wp.waypoint_index ?? -1);

      const polyline: LatLng[] = (trip.geometry?.coordinates ?? []).map(
        ([lng, lat]: [number, number]) => ({ lat, lng })
      );

      return {
        order: tripPosOfInput,
        polyline,
        distanceM: trip.distance ?? 0,
        durationS: trip.duration ?? 0,
      };
    } catch {
      continue;
    }
  }
  return null;
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

    let ordered = [...withCoords];
    let polyline: LatLng[] | null = null;
    let totalKm = routeTotalKm(withCoords);
    let source: 'osrm' | 'local' = 'local';
    let durationMin: number | undefined;

    const start: LatLng = {
      lat: startLat ?? WAREHOUSE_LAT,
      lng: startLng ?? WAREHOUSE_LNG,
    };

    if (withCoords.length > 0) {
      const trip = await tryOsrmTrip([start, ...withCoords]);
      if (trip && trip.order.length === withCoords.length + 1) {
        // trip.order[i] = posisi di trip untuk input ke-i. Susun ulang dengan
        // mengurutkan delivery (input 1..n) berdasarkan posisi trip-nya.
        const byTripPos = trip.order
          .map((tripPos, inputIdx) => ({ tripPos, inputIdx }))
          .sort((a, b) => a.tripPos - b.tripPos);
        ordered = byTripPos
          .filter((x) => x.inputIdx > 0)
          .map((x) => withCoords[x.inputIdx - 1]);
        polyline = trip.polyline;
        totalKm = Math.round((trip.distanceM / 1000) * 10) / 10;
        durationMin = Math.round(trip.durationS / 60);
        source = 'osrm';
      } else {
        ordered = orOpt(twoOpt(nearestNeighbor(withCoords, startLat, startLng)));
        totalKm = routeTotalKm(ordered);
      }
    }

    const result = [...ordered, ...withoutCoords].map((w, i) => ({ ...w, sequence: i + 1 }));

    await db.delete(deliveryRoutePoint)
      .where(and(eq(deliveryRoutePoint.route_date, today), eq(deliveryRoutePoint.status, 'pending')));

    for (const wp of result) {
      await db.insert(deliveryRoutePoint).values({
        route_date: today,
        id_transaksi: wp.idTransaksi,
        sequence_no: wp.sequence,
        lat: String(wp.lat),
        lng: String(wp.lng),
        status: 'pending',
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        waypoints: result,
        totalStops: result.length,
        totalEstimatedKm: totalKm,
        source,
        routePolyline: polyline,
        routeDurationMin: durationMin,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal optimasi rute' }, { status: 500 });
  }
}
