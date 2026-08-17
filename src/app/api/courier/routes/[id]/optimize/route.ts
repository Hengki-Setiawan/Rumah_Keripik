import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryRoutes, deliveryRoutePoint, routeOptimizationRuns } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { requireCourierAuth } from '@/lib/courier-auth';
import { nearestNeighbor, twoOpt, routeTotalKm } from '@/lib/courier/routing';
import { optimizeMultiVehicle, orsEnabled } from '@/lib/courier/ors';

const DEFAULT_SERVICE_SECONDS = 300;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const courier = await requireCourierAuth(request);
    if (!courier) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return NextResponse.json({ ok: false, error: 'ID tidak valid' }, { status: 400 });

    const [route] = await db
      .select()
      .from(deliveryRoutes)
      .where(and(eq(deliveryRoutes.id, id), eq(deliveryRoutes.courierId, courier.id)))
      .limit(1);
    if (!route) return NextResponse.json({ ok: false, error: 'Jalur tidak ditemukan atau bukan milik Anda' }, { status: 404 });

    const points = await db
      .select()
      .from(deliveryRoutePoint)
      .where(eq(deliveryRoutePoint.route_id, id))
      .orderBy(deliveryRoutePoint.sequence_no);

    const withCoord = points.filter((p) => p.lat && p.lng);
    const withoutCoord = points.filter((p) => !p.lat || !p.lng);

    // Depot = posisi GPS kurir saat ini (bukan gudang), konsisten perilaku lama.
    const body = await request.json().catch(() => ({}));
    const startLat = body.currentLat ? Number(body.currentLat) : Number(courier.last_lat);
    const startLng = body.currentLng ? Number(body.currentLng) : Number(courier.last_lng);
    const hasStart = Number.isFinite(startLat) && Number.isFinite(startLng) && !(startLat === 0 && startLng === 0);
    const depot = hasStart
      ? { lat: startLat as number, lng: startLng as number }
      : withCoord.length > 0
        ? { lat: Number(withCoord[0].lat), lng: Number(withCoord[0].lng) }
        : { lat: -5.105950, lng: 119.432407 };

    let ordered: Array<{ id: number; lat: number; lng: number }> = withCoord.map((p) => ({ id: p.id, lat: Number(p.lat), lng: Number(p.lng) }));
    let totalKm = routeTotalKm(ordered.map((p) => ({ lat: p.lat, lng: p.lng })));
    let source: 'ors' | 'local' = 'local';
    let durationMin: number | undefined;

    if (withCoord.length > 0 && hasStart) {
      if (orsEnabled()) {
        try {
          const result = await optimizeMultiVehicle(
            [{ id: 1, profile: 'driving-car', start: [depot.lng, depot.lat] }],
            withCoord.map((p, idx) => ({ id: idx + 1, location: [Number(p.lng), Number(p.lat)], service: DEFAULT_SERVICE_SECONDS })),
          );
          const routeSteps = result.routes?.[0]?.steps ?? [];
          const orderedIdx = routeSteps
            .filter((s): s is { type: string; job: number; location: [number, number]; service?: number } =>
              s.type === 'job' && s.job != null)
            .map((s) => s.job - 1);
          if (orderedIdx.length === withCoord.length) {
            ordered = orderedIdx.map((idx) => ({ id: withCoord[idx].id, lat: Number(withCoord[idx].lat), lng: Number(withCoord[idx].lng) }));
            totalKm = Math.round((result.routes?.[0]?.distance ?? 0) / 1000 * 10) / 10;
            durationMin = Math.round((result.routes?.[0]?.duration ?? 0) / 60);
            source = 'ors';
          }
        } catch {
          // fallback lokal
        }
      }
      if (source === 'local') {
        ordered = twoOpt(nearestNeighbor(ordered, depot.lat, depot.lng), 50);
        totalKm = routeTotalKm(ordered.map((p) => ({ lat: p.lat, lng: p.lng })));
      }
    }

    const seq = new Map<number, number>();
    [...ordered, ...withoutCoord].forEach((p, i) => seq.set(p.id, i + 1));
    for (const p of points) {
      await db.update(deliveryRoutePoint).set({ sequence_no: seq.get(p.id) ?? p.sequence_no }).where(eq(deliveryRoutePoint.id, p.id));
    }
    await db
      .update(deliveryRoutes)
      .set({
        stopCount: points.length,
        estimatedDistanceKm: String(totalKm),
        estimatedDurationMinutes: durationMin ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(deliveryRoutes.id, id));

    await db.insert(routeOptimizationRuns).values({
      routeDate: route.routeDate,
      courierId: courier.id,
      algorithmVersion: source === 'ors' ? 'ors-vroom' : 'two-opt',
      stopCount: points.length,
      estimatedDistanceKm: String(totalKm),
      estimatedDurationMinutes: durationMin ?? null,
      routingEngineUsed: source,
      triggeredBy: 'courier_refresh',
    }).catch((err) => console.error('[COURIER_ROUTE_OPTIMIZE_LOG]', err));

    const idTransaksiOf = new Map<number, string>(points.map((p) => [p.id, p.id_transaksi]));
    const waypoints = [...ordered, ...withoutCoord].map((p) => {
      const tx = idTransaksiOf.get(p.id);
      return {
        sequence: 0,
        deliveryId: p.id,
        idTransaksi: tx ?? '',
        lat: Number(p.lat) || 0,
        lng: Number(p.lng) || 0,
      };
    }).map((w, i) => ({ ...w, sequence: i + 1 }));

    return NextResponse.json({
      ok: true,
      data: {
        waypoints,
        totalStops: waypoints.length,
        totalEstimatedKm: totalKm,
        source,
        routeDurationMin: durationMin,
      },
    });
  } catch (error) {
    console.error('[COURIER_ROUTE_OPTIMIZE]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}