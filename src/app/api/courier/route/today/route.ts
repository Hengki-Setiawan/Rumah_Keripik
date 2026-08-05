import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, transaksi, deliveryRoutePoint, routeOptimizationRuns } from '@/lib/schema';
import { requireCourierAuth } from '@/lib/courier-auth';
import { eq, and, sql } from 'drizzle-orm';
import { nearestNeighbor, twoOpt, routeTotalKm } from '@/lib/courier/routing';

const GUDANG_LAT = -5.1340;
const GUDANG_LNG = 119.4135;

interface TodayDelivery {
  delivery_id: number;
  id_transaksi: string;
  lat: number;
  lng: number;
  address: string;
  sequence_no: number | null;
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

    const validDeliveries = deliveries.filter(
      (d): d is { delivery_id: number; id_transaksi: string; lat: string | null; lng: string | null; address: string | null; sequence_no: number | null } =>
        !!d.lat && !!d.lng
    );

    const hasSequence = validDeliveries.some((d) => d.sequence_no != null);

    let waypoints: Array<{ lat: number; lng: number; name: string; type: 'start' | 'destination'; delivery_id?: number; id_transaksi?: string; sequence_no?: number }>;
    let sortedDeliveries: TodayDelivery[] = [];

    if (!hasSequence && validDeliveries.length > 1) {
      sortedDeliveries = validDeliveries.map((d) => ({
        delivery_id: d.delivery_id,
        id_transaksi: d.id_transaksi,
        lat: parseFloat(d.lat!),
        lng: parseFloat(d.lng!),
        address: d.address || `Order ${d.id_transaksi}`,
        sequence_no: null,
      }));

      const nn = nearestNeighbor(sortedDeliveries, GUDANG_LAT, GUDANG_LNG);
      const optimized = twoOpt(nn, 50);
      sortedDeliveries = optimized.map((d, i) => ({ ...d, sequence_no: i + 1 }));

      const startedAt = Date.now();
      await db.transaction(async (tx) => {
        for (const point of sortedDeliveries) {
          await tx.insert(deliveryRoutePoint).values({
            route_date: today,
            id_transaksi: point.id_transaksi,
            sequence_no: point.sequence_no!,
            lat: String(point.lat),
            lng: String(point.lng),
            address: point.address,
            status: 'pending',
          }).onConflictDoUpdate({
            target: [deliveryRoutePoint.route_date, deliveryRoutePoint.id_transaksi],
            set: { sequence_no: point.sequence_no! },
          });
        }

        await tx.insert(routeOptimizationRuns).values({
          routeDate: today,
          courierId: courier.id,
          algorithmVersion: 'two-opt',
          stopCount: sortedDeliveries.length,
          estimatedDistanceKm: String(routeTotalKm(sortedDeliveries)),
          routingEngineUsed: 'haversine',
          computationMs: Date.now() - startedAt,
          triggeredBy: 'courier_refresh',
        });
      });

      waypoints = [
        { lat: GUDANG_LAT, lng: GUDANG_LNG, name: 'Gudang', type: 'start' as const },
        ...sortedDeliveries.map((d) => ({
          lat: d.lat, lng: d.lng, name: d.address, type: 'destination' as const,
          delivery_id: d.delivery_id, id_transaksi: d.id_transaksi, sequence_no: d.sequence_no!,
        })),
      ];

      return NextResponse.json({ ok: true, waypoints, total_deliveries: sortedDeliveries.length });
    }

    waypoints = [
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
