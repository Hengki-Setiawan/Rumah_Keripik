import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, deliveryRoutePoint, transaksi, routeOptimizationRuns } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';
import { nearestNeighbor, twoOpt, routeTotalKm } from '@/lib/courier/routing';

const GUDANG_LAT = -5.1340;
const GUDANG_LNG = 119.4135;

export async function GET(req: Request) {
  try {
    await requireAdminRole('courier:manage');

    const url = new URL(req.url);
    const courierId = url.searchParams.get('courierId');
    const routeDate = url.searchParams.get('routeDate');
    const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);

    const conditions = [];
    if (courierId) conditions.push(eq(deliveryAssignment.kurir_id, parseInt(courierId)));
    if (routeDate) conditions.push(eq(deliveryRoutePoint.route_date, routeDate));

    const rows = await db
      .select({
        assignmentId: deliveryAssignment.id,
        id_transaksi: deliveryAssignment.id_transaksi,
        kurir_id: deliveryAssignment.kurir_id,
        kurir_name: deliveryAssignment.kurir_name,
        status: deliveryAssignment.status,
        pickup_at: deliveryAssignment.pickup_at,
        delivered_at: deliveryAssignment.delivered_at,
        kode_pesanan: transaksi.kode_pesanan,
        nama_penerima: transaksi.nama_penerima,
        alamat_penerima: transaksi.alamat_penerima,
        route_date: deliveryRoutePoint.route_date,
        sequence_no: deliveryRoutePoint.sequence_no,
        stop_status: deliveryRoutePoint.status,
        created_at: deliveryAssignment.created_at,
      })
      .from(deliveryAssignment)
      .leftJoin(transaksi, eq(deliveryAssignment.id_transaksi, transaksi.id_transaksi))
      .leftJoin(deliveryRoutePoint, eq(deliveryRoutePoint.id_transaksi, deliveryAssignment.id_transaksi))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(sql`${deliveryRoutePoint.route_date} DESC`, deliveryRoutePoint.sequence_no)
      .limit(limit);

    return NextResponse.json({ ok: true, routes: rows });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[ADMIN_ROUTES]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminRole('courier:manage');

    const url = new URL(req.url);
    const routeDate = url.searchParams.get('routeDate') ?? new Date().toISOString().slice(0, 10);
    const body = await req.json().catch(() => ({}));
    const courierIdParam = body.courierId ? Number(body.courierId) : null;

    const pending = await db
      .select({
        id: deliveryAssignment.id,
        idTransaksi: deliveryAssignment.id_transaksi,
        kurirId: deliveryAssignment.kurir_id,
        lat: transaksi.lat_pengiriman,
        lng: transaksi.lng_pengiriman,
      })
      .from(deliveryAssignment)
      .leftJoin(transaksi, eq(deliveryAssignment.id_transaksi, transaksi.id_transaksi))
      .where(and(
        courierIdParam != null && Number.isInteger(courierIdParam)
          ? eq(deliveryAssignment.kurir_id, courierIdParam)
          : sql`1=1`,
        sql`date(${deliveryAssignment.created_at}) = ${routeDate}`,
        sql`${deliveryAssignment.status} IN ('Siap_Dikirim','Dalam_Pengiriman')`,
      ));

    const byCourier = new Map<number, typeof pending>();
    for (const p of pending) {
      if (p.kurirId == null) continue;
      const arr = byCourier.get(p.kurirId) ?? [];
      arr.push(p);
      byCourier.set(p.kurirId, arr);
    }

    let computed = 0;
    for (const [courierId, stops] of byCourier) {
      const withCoords = stops
        .filter((s) => s.lat && s.lng)
        .map((s) => ({ id: s.id, idTransaksi: s.idTransaksi, lat: Number(s.lat), lng: Number(s.lng) }));
      const withoutCoords = stops.filter((s) => !s.lat || !s.lng);

      const startedAt = Date.now();
      const optimized = withCoords.length > 0
        ? twoOpt(nearestNeighbor(withCoords, GUDANG_LAT, GUDANG_LNG), 50)
        : [];
      const ordered = [
        ...optimized,
        ...withoutCoords.map((s) => ({ id: s.id, idTransaksi: s.idTransaksi, lat: 0, lng: 0 })),
      ];

      await db.delete(deliveryRoutePoint)
        .where(and(eq(deliveryRoutePoint.route_date, routeDate), sql`${deliveryRoutePoint.status} = 'pending'`));

      for (const [i, wp] of ordered.entries()) {
        await db.insert(deliveryRoutePoint).values({
          route_date: routeDate,
          id_transaksi: wp.idTransaksi,
          sequence_no: i + 1,
          lat: String(wp.lat || ''),
          lng: String(wp.lng || ''),
          status: 'pending',
        });
      }

      await db.insert(routeOptimizationRuns).values({
        routeDate,
        courierId,
        algorithmVersion: 'two-opt',
        stopCount: ordered.length,
        estimatedDistanceKm: String(routeTotalKm(optimized)),
        routingEngineUsed: 'haversine',
        computationMs: Date.now() - startedAt,
        triggeredBy: 'admin_manual',
      });

      computed++;
    }

    return NextResponse.json({ ok: true, data: { routeDate, couriersProcessed: computed } });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[ADMIN_ROUTES_OPTIMIZE]', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal optimasi rute' }, { status: 500 });
  }
}