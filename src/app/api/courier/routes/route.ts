import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryRoutes, deliveryRoutePoint, warehouses, deliveryAssignment } from '@/lib/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { requireCourierAuth } from '@/lib/courier-auth';
import { haversineKm } from '@/lib/courier-distance';
import { witaToday } from '@/lib/wita-date';

const MAX_ROUTE_KM = 60;

export async function GET(request: Request) {
  try {
    const courier = await requireCourierAuth(request);
    if (!courier) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const routeDate = url.searchParams.get('routeDate') ?? witaToday();

    const routes = await db
      .select({
        id: deliveryRoutes.id,
        routeName: deliveryRoutes.routeName,
        routeDate: deliveryRoutes.routeDate,
        status: deliveryRoutes.status,
        courierId: deliveryRoutes.courierId,
        warehouseId: deliveryRoutes.warehouseId,
        warehouseName: warehouses.name,
        stopCount: deliveryRoutes.stopCount,
        estimatedDistanceKm: deliveryRoutes.estimatedDistanceKm,
        estimatedDurationMinutes: deliveryRoutes.estimatedDurationMinutes,
        createdAt: deliveryRoutes.createdAt,
      })
      .from(deliveryRoutes)
      .leftJoin(warehouses, eq(deliveryRoutes.warehouseId, warehouses.id))
      .where(eq(deliveryRoutes.routeDate, routeDate))
      .orderBy(desc(deliveryRoutes.id));

    const withStops = await Promise.all(
      routes.map(async (r) => {
        const stops = await db
          .select({
            id: deliveryRoutePoint.id,
            idTransaksi: deliveryRoutePoint.id_transaksi,
            sequenceNo: deliveryRoutePoint.sequence_no,
            lat: deliveryRoutePoint.lat,
            lng: deliveryRoutePoint.lng,
            address: deliveryRoutePoint.address,
          })
          .from(deliveryRoutePoint)
          .where(eq(deliveryRoutePoint.route_id, r.id))
          .orderBy(deliveryRoutePoint.sequence_no);
        const firstStop = stops.find((s) => s.lat && s.lng);
        const hasCoord = firstStop
          ? Number.isFinite(Number(firstStop.lat)) && Number.isFinite(Number(firstStop.lng))
          : false;
        const cLat = Number(courier.last_lat);
        const cLng = Number(courier.last_lng);
        const hasGps = Number.isFinite(cLat) && Number.isFinite(cLng) && !(cLat === 0 && cLng === 0);
        const inRadius =
          !hasGps || !hasCoord ||
          haversineKm(cLat, cLng, Number(firstStop!.lat), Number(firstStop!.lng)) <= MAX_ROUTE_KM;
        return { ...r, stops: stops.slice(0, 3), areaPreview: stops.slice(0, 3).map((s) => s.address).filter(Boolean), inRadius };
      })
    );

    const available = withStops.filter((r) => r.status === 'open' && r.inRadius);
    const mine = withStops.filter((r) => r.status !== 'open' && r.status !== 'completed' && r.status !== 'cancelled' && r.courierId === courier.id);
    const history = withStops.filter((r) => r.courierId === courier.id && (r.status === 'completed' || r.status === 'cancelled'));
    const other = withStops.filter((r) => r.status !== 'open' && r.courierId !== courier.id && r.status !== 'completed' && r.status !== 'cancelled');

    const assignedCount = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(deliveryAssignment)
      .where(and(eq(deliveryAssignment.kurir_id, courier.id), sql`${deliveryAssignment.status} IN ('Siap_Dikirim','Dalam_Pengiriman')`));
    const hasActiveRoute = mine.some((r) => r.status === 'claimed' || r.status === 'in_progress');

    return NextResponse.json({
      ok: true,
      data: {
        available,
        mine,
        history,
        other,
        assignedCount: assignedCount[0]?.c ?? 0,
        hasActiveRoute,
      },
    });
  } catch (error) {
    console.error('[COURIER_ROUTES]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}