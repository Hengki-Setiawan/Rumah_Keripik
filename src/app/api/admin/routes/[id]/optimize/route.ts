import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryRoutes, deliveryRoutePoint, warehouses, routeOptimizationRuns } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';
import { nearestNeighbor, twoOpt, routeTotalKm } from '@/lib/courier/routing';

function unauthorized(error: unknown) {
  return error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION');
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminRole('courier:manage');
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return NextResponse.json({ ok: false, error: 'ID tidak valid' }, { status: 400 });

    const [route] = await db.select().from(deliveryRoutes).where(eq(deliveryRoutes.id, id)).limit(1);
    if (!route) return NextResponse.json({ ok: false, error: 'Jalur tidak ditemukan' }, { status: 404 });

    const points = await db.select().from(deliveryRoutePoint).where(eq(deliveryRoutePoint.route_id, id));
    const [warehouse] = await db
      .select({ lat: warehouses.lat, lng: warehouses.lng })
      .from(warehouses)
      .where(eq(warehouses.id, route.warehouseId ?? 1))
      .limit(1);
    const wLat = Number(warehouse?.lat) || -5.105950;
    const wLng = Number(warehouse?.lng) || 119.432407;

    const withCoord = points.filter((p) => p.lat && p.lng).map((p) => ({ id: p.id, lat: Number(p.lat), lng: Number(p.lng) }));
    const withoutCoord = points.filter((p) => !p.lat || !p.lng);

    const ordered = twoOpt(nearestNeighbor(withCoord, wLat, wLng), 50);
    const seq = new Map<number, number>();
    [...ordered, ...withoutCoord].forEach((p, i) => seq.set(p.id, i + 1));

    for (const p of points) {
      await db.update(deliveryRoutePoint).set({ sequence_no: seq.get(p.id) ?? p.sequence_no }).where(eq(deliveryRoutePoint.id, p.id));
    }

    const totalKm = routeTotalKm(ordered);
    await db
      .update(deliveryRoutes)
      .set({ stopCount: points.length, estimatedDistanceKm: String(totalKm), updatedAt: new Date().toISOString() })
      .where(eq(deliveryRoutes.id, id));

    if (route.courierId) {
      await db.insert(routeOptimizationRuns).values({
        routeDate: route.routeDate,
        courierId: route.courierId,
        algorithmVersion: 'two-opt',
        stopCount: points.length,
        estimatedDistanceKm: String(totalKm),
        routingEngineUsed: 'haversine',
        triggeredBy: 'admin_manual',
      }).catch((err) => console.error('[ADMIN_ROUTES_OPTIMIZE_LOG]', err));
    }

    return NextResponse.json({ ok: true, data: { estimatedDistanceKm: String(totalKm), stopCount: points.length } });
  } catch (error) {
    if (unauthorized(error)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    console.error('[ADMIN_ROUTES_OPTIMIZE]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}