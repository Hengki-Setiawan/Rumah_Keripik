import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, transaksi, deliveryRoutePoint } from '@/lib/schema';
import { requireCourierAuth } from '@/lib/courier-auth';
import { eq, and, sql } from 'drizzle-orm';
import { getOrCreateCorrelationId } from '@/lib/correlation-id';

const GUDANG_LAT = -5.1340;
const GUDANG_LNG = 119.4135;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestNeighborSort(points: Array<{ delivery_id: number; id_transaksi: string; lat: number; lng: number; address: string }>): Array<{ delivery_id: number; id_transaksi: string; lat: number; lng: number; address: string; sequence_no: number }> {
  if (points.length === 0) return [];
  
  let currentLat = GUDANG_LAT;
  let currentLng = GUDANG_LNG;
  const remaining = [...points];
  const sorted: Array<{ delivery_id: number; id_transaksi: string; lat: number; lng: number; address: string; sequence_no: number }> = [];

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineKm(currentLat, currentLng, remaining[i].lat, remaining[i].lng);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    const nearest = remaining[nearestIdx];
    sorted.push({ ...nearest, sequence_no: sorted.length + 1 });
    currentLat = nearest.lat;
    currentLng = nearest.lng;
    remaining.splice(nearestIdx, 1);
  }

  return sorted;
}

export async function GET(request: Request) {
  try {
    const courier = await requireCourierAuth(request);
    if (!courier) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date().toISOString().slice(0, 10);

    const deliveries = await db
      .select({
        delivery_id: deliveryAssignment.id,
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
          sql`${deliveryAssignment.created_at} LIKE ${today + '%'}`
        )
      )
      .orderBy(deliveryRoutePoint.sequence_no);

    const validDeliveries = deliveries.filter((d) => d.lat && d.lng);

    const hasSequence = validDeliveries.some((d) => d.sequence_no != null);

    if (!hasSequence && validDeliveries.length > 1) {
      const unsorted = validDeliveries.map((d) => ({
        delivery_id: d.delivery_id,
        id_transaksi: d.id_transaksi,
        lat: parseFloat(d.lat!),
        lng: parseFloat(d.lng!),
        address: d.address || `Order ${d.id_transaksi}`,
      }));
      const sorted = nearestNeighborSort(unsorted);

      for (const point of sorted) {
        await db.insert(deliveryRoutePoint).values({
          route_date: today,
          id_transaksi: point.id_transaksi,
          sequence_no: point.sequence_no,
          lat: String(point.lat),
          lng: String(point.lng),
          address: point.address,
          status: 'pending',
        }).onConflictDoUpdate({
          target: [deliveryRoutePoint.route_date, deliveryRoutePoint.id_transaksi],
          set: { sequence_no: point.sequence_no },
        });
      }

      const waypoints = [
        { lat: GUDANG_LAT, lng: GUDANG_LNG, name: 'Gudang', type: 'start' as const },
        ...sorted.map((d) => ({
          lat: d.lat, lng: d.lng, name: d.address, type: 'destination' as const,
          delivery_id: d.delivery_id, id_transaksi: d.id_transaksi, sequence_no: d.sequence_no,
        })),
      ];

      return NextResponse.json({ ok: true, waypoints, total_deliveries: sorted.length });
    }

    const waypoints = [
      {
        lat: GUDANG_LAT,
        lng: GUDANG_LNG,
        name: 'Gudang',
        type: 'start' as const,
      },
      ...validDeliveries
        .map((d) => ({
          lat: parseFloat(d.lat!),
          lng: parseFloat(d.lng!),
          name: d.address || `Order ${d.id_transaksi}`,
          type: 'destination' as const,
          delivery_id: d.delivery_id,
          id_transaksi: d.id_transaksi,
          sequence_no: d.sequence_no ?? 0,
        })),
    ];

    return NextResponse.json({
      ok: true,
      waypoints,
      total_deliveries: validDeliveries.length,
    });
  } catch (error) {
    console.error('[COURIER_ROUTE_TODAY]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
