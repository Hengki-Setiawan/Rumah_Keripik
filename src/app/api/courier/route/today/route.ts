import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, transaksi, deliveryRoutePoint, routeOptimizationRuns } from '@/lib/schema';
import { requireCourierAuth } from '@/lib/courier-auth';
import { eq, and, sql } from 'drizzle-orm';
import { nearestNeighbor, twoOpt, routeTotalKm } from '@/lib/courier/routing';

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

    // Titik mulai rute = posisi kurir (tidak ada gudang). Dikirim lewat query
    // `startLat`/`startLng`. Tanpa posisi, urutkan by created (no geo-seed).
    const url = new URL(request.url);
    const startLat = Number(url.searchParams.get('startLat') ?? NaN);
    const startLng = Number(url.searchParams.get('startLng') ?? NaN);
    const hasStart = Number.isFinite(startLat) && Number.isFinite(startLng);

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
      .from(transaksi)
      .leftJoin(deliveryAssignment, eq(transaksi.id_transaksi, deliveryAssignment.id_transaksi))
      .leftJoin(
        deliveryRoutePoint,
        and(
          eq(deliveryRoutePoint.id_transaksi, transaksi.id_transaksi),
          eq(deliveryRoutePoint.route_date, today)
        )
      )
      .where(
        and(
          sql`${transaksi.order_status} IN ('ready', 'confirmed', 'shipping', 'awaiting_admin_confirmation', 'Menunggu_Verifikasi')`,
          sql`(${deliveryAssignment.kurir_id} IS NULL OR ${deliveryAssignment.kurir_id} = ${courier.id})`
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

      if (hasStart) {
        const nn = nearestNeighbor(sortedDeliveries, startLat, startLng);
        const optimized = twoOpt(nn, 50);
        sortedDeliveries = optimized.map((d, i) => ({ ...d, sequence_no: i + 1 }));
      } else {
        // Tanpa posisi kurir: pertahankan urutan input (created_at), tanpa seed geo.
        sortedDeliveries = sortedDeliveries.map((d, i) => ({ ...d, sequence_no: i + 1 }));
      }

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

      waypoints = hasStart
        ? [
            { lat: startLat, lng: startLng, name: 'Posisi Kurir', type: 'start' as const },
            ...sortedDeliveries.map((d) => ({
              lat: d.lat, lng: d.lng, name: d.address, type: 'destination' as const,
              delivery_id: d.delivery_id, id_transaksi: d.id_transaksi, sequence_no: d.sequence_no!,
            })),
          ]
        : sortedDeliveries.map((d) => ({
            lat: d.lat, lng: d.lng, name: d.address, type: 'destination' as const,
            delivery_id: d.delivery_id, id_transaksi: d.id_transaksi, sequence_no: d.sequence_no!,
          }));

      return NextResponse.json({ ok: true, waypoints, total_deliveries: sortedDeliveries.length });
    }

    waypoints = hasStart
      ? [
          { lat: startLat, lng: startLng, name: 'Posisi Kurir', type: 'start' as const },
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
        ]
      : validDeliveries
          .map((d) => ({
            lat: parseFloat(d.lat!),
            lng: parseFloat(d.lng!),
            name: d.address || `Order ${d.id_transaksi}`,
            type: 'destination' as const,
            delivery_id: d.delivery_id,
            id_transaksi: d.id_transaksi,
            sequence_no: d.sequence_no ?? 0,
          }));

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
