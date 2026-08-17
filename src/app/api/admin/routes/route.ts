import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryRoutes, deliveryRoutePoint, transaksi, couriers, warehouses } from '@/lib/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';
import { nearestNeighbor, twoOpt, routeTotalKm } from '@/lib/courier/routing';
import { witaToday } from '@/lib/wita-date';
import { z } from 'zod';
import { buildRoutesForDate } from '@/lib/route-builder';
import { claimRoute } from '@/lib/route-assign';

function unauthorized(error: unknown) {
  return error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION');
}

const CreateRouteSchema = z.object({
  routeDate: z.string().optional(),
  warehouseId: z.number().optional(),
  routeName: z.string().optional(),
  courierId: z.number().optional(),
  capacityKg: z.number().optional(),
  auto: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    await requireAdminRole('courier:manage');

    const url = new URL(req.url);
    const routeDate = url.searchParams.get('routeDate') ?? witaToday();
    const status = url.searchParams.get('status');
    const courierId = url.searchParams.get('courierId');

    const conditions = [eq(deliveryRoutes.routeDate, routeDate)];
    if (status) conditions.push(eq(deliveryRoutes.status, status as 'open' | 'claimed' | 'in_progress' | 'completed' | 'cancelled'));
    if (courierId) conditions.push(eq(deliveryRoutes.courierId, parseInt(courierId)));

    const routes = await db
      .select({
        id: deliveryRoutes.id,
        routeName: deliveryRoutes.routeName,
        routeDate: deliveryRoutes.routeDate,
        status: deliveryRoutes.status,
        courierId: deliveryRoutes.courierId,
        courierName: couriers.name,
        warehouseId: deliveryRoutes.warehouseId,
        warehouseName: warehouses.name,
        stopCount: deliveryRoutes.stopCount,
        estimatedDistanceKm: deliveryRoutes.estimatedDistanceKm,
        estimatedDurationMinutes: deliveryRoutes.estimatedDurationMinutes,
        createdAt: deliveryRoutes.createdAt,
        completedAt: deliveryRoutes.completedAt,
      })
      .from(deliveryRoutes)
      .leftJoin(couriers, eq(deliveryRoutes.courierId, couriers.id))
      .leftJoin(warehouses, eq(deliveryRoutes.warehouseId, warehouses.id))
      .where(and(...conditions))
      .orderBy(desc(deliveryRoutes.id));

    const routesWithStops = await Promise.all(
      routes.map(async (r) => {
        const stops = await db
          .select({
            id: deliveryRoutePoint.id,
            idTransaksi: deliveryRoutePoint.id_transaksi,
            sequenceNo: deliveryRoutePoint.sequence_no,
            lat: deliveryRoutePoint.lat,
            lng: deliveryRoutePoint.lng,
            address: deliveryRoutePoint.address,
            stopStatus: deliveryRoutePoint.status,
            kodePesanan: transaksi.kode_pesanan,
            penerima: transaksi.nama_penerima,
            orderStatus: transaksi.order_status,
            paymentStatus: transaksi.payment_status,
          })
          .from(deliveryRoutePoint)
          .leftJoin(transaksi, eq(deliveryRoutePoint.id_transaksi, transaksi.id_transaksi))
          .where(eq(deliveryRoutePoint.route_id, r.id))
          .orderBy(deliveryRoutePoint.sequence_no);
        return { ...r, stops };
      })
    );

    return NextResponse.json({ ok: true, routes: routesWithStops });
  } catch (error) {
    if (unauthorized(error)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    console.error('[ADMIN_ROUTES]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { actor } = await requireAdminRole('courier:manage');
    const url = new URL(req.url);
    const routeDate = url.searchParams.get('routeDate') ?? witaToday();

    const body = await req.json().catch(() => ({}));
    const parsed = CreateRouteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid' }, { status: 400 });
    }

    const { auto } = parsed.data;
    if (auto) {
      const result = await buildRoutesForDate(routeDate);
      return NextResponse.json({ ok: true, data: result });
    }

    const warehouse = await db
      .select({ lat: warehouses.lat, lng: warehouses.lng })
      .from(warehouses)
      .where(eq(warehouses.id, parsed.data.warehouseId ?? 1))
      .limit(1);
    const warehouseLat = Number(warehouse[0]?.lat) || -5.105950;
    const warehouseLng = Number(warehouse[0]?.lng) || 119.432407;

    // Kumpulkan pesanan processing yang belum masuk jalur mana pun untuk tanggal ini.
    const pending = await db
      .select({
        idTransaksi: transaksi.id_transaksi,
        kodePesanan: transaksi.kode_pesanan,
        lat: transaksi.lat_pengiriman,
        lng: transaksi.lng_pengiriman,
      })
      .from(transaksi)
      .where(and(
        eq(transaksi.order_status, 'processing'),
        isNullRoutePoint(routeDate),
      ));

    const withCoords = pending.filter((p) => p.lat && p.lng);
    const ordered = twoOpt(
      nearestNeighbor(withCoords.map((p) => ({ idTransaksi: p.idTransaksi, lat: Number(p.lat), lng: Number(p.lng) })), warehouseLat, warehouseLng),
      50
    );
    const all = [...ordered, ...pending.filter((p) => !withCoords.includes(p))];

    // Validasi kurir SEBELUM insert — bila invalid jangan buat jalur orphan.
    let assignCourier: { id: number; name: string } | null = null;
    if (parsed.data.courierId) {
      const [courier] = await db
        .select({ id: couriers.id, name: couriers.name })
        .from(couriers)
        .where(and(eq(couriers.id, parsed.data.courierId), eq(couriers.is_active, 1)))
        .limit(1);
      if (!courier) throw new Error('Kurir tidak ditemukan atau tidak aktif');
      assignCourier = courier;
    }

    const existingCount = await db.select({ c: sql<number>`COUNT(*)` }).from(deliveryRoutes).where(eq(deliveryRoutes.routeDate, routeDate));
    const defaultName = parsed.data.routeName ?? `Jalur ${routeDate} #${(existingCount[0]?.c ?? 0) + 1}`;

    const [inserted] = await db
      .insert(deliveryRoutes)
      .values({
        routeDate,
        routeName: defaultName,
        warehouseId: parsed.data.warehouseId ?? 1,
        courierId: null,
        status: 'open',
        capacityKg: parsed.data.capacityKg ?? null,
        stopCount: all.length,
        estimatedDistanceKm: String(routeTotalKm(ordered)),
        createdByType: 'admin',
        createdBy: actor,
      })
      .returning();

    for (const [i, wp] of all.entries()) {
      await db.insert(deliveryRoutePoint).values({
        route_date: routeDate,
        id_transaksi: wp.idTransaksi,
        route_id: inserted.id,
        sequence_no: i + 1,
        lat: String(wp.lat ?? ''),
        lng: String(wp.lng ?? ''),
        status: 'pending',
      });
    }

    if (assignCourier) {
      await claimRoute(inserted.id, assignCourier.id, 'admin', assignCourier.name);
    }

    return NextResponse.json({ ok: true, route: inserted });
  } catch (error) {
    if (unauthorized(error)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    console.error('[ADMIN_ROUTES_CREATE]', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal membuat jalur' }, { status: 500 });
  }
}

function isNullRoutePoint(routeDate: string) {
  return sql`NOT EXISTS (
    SELECT 1 FROM delivery_route_point rp
    WHERE rp.id_transaksi = transaksi.id_transaksi AND rp.route_date = ${routeDate}
  )`;
}