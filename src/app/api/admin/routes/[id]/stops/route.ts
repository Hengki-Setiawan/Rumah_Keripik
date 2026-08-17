import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryRoutes, deliveryRoutePoint, deliveryAssignment, transaksi, couriers } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';
import { z } from 'zod';

function unauthorized(error: unknown) {
  return error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION');
}

const StopSchema = z.object({
  idTransaksi: z.string().min(1),
  sequenceNo: z.number().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminRole('courier:manage');
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return NextResponse.json({ ok: false, error: 'ID tidak valid' }, { status: 400 });

    const [route] = await db.select().from(deliveryRoutes).where(eq(deliveryRoutes.id, id)).limit(1);
    if (!route) return NextResponse.json({ ok: false, error: 'Jalur tidak ditemukan' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const parsed = StopSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'Data tidak valid' }, { status: 400 });

    const [tx] = await db
      .select({ lat: transaksi.lat_pengiriman, lng: transaksi.lng_pengiriman })
      .from(transaksi)
      .where(eq(transaksi.id_transaksi, parsed.data.idTransaksi))
      .limit(1);
    if (!tx) return NextResponse.json({ ok: false, error: 'Pesanan tidak ditemukan' }, { status: 404 });

    // Cegah pesanan masuk 2 jalur aktif pada tanggal sama.
    const [dup] = await db
      .select({ id: deliveryRoutePoint.id })
      .from(deliveryRoutePoint)
      .where(and(
        eq(deliveryRoutePoint.route_date, route.routeDate),
        eq(deliveryRoutePoint.id_transaksi, parsed.data.idTransaksi)
      ))
      .limit(1);
    if (dup) return NextResponse.json({ ok: false, error: 'Pesanan sudah ada di jalur pada tanggal ini' }, { status: 409 });

    const [maxSeqRow] = await db
      .select({ max: sql<number>`MAX(${deliveryRoutePoint.sequence_no})` })
      .from(deliveryRoutePoint)
      .where(eq(deliveryRoutePoint.route_id, id));
    const seq = parsed.data.sequenceNo ?? (maxSeqRow?.max ?? 0) + 1;

    await db.insert(deliveryRoutePoint).values({
      route_date: route.routeDate,
      id_transaksi: parsed.data.idTransaksi,
      route_id: id,
      sequence_no: seq,
      lat: tx.lat ?? '',
      lng: tx.lng ?? '',
      status: 'pending',
    });

    // Kalau jalur sudah diambil & belum selesai, assignment langsung dibuat.
    const routeIsActive = route.status === 'claimed' || route.status === 'in_progress';
    if (route.courierId && routeIsActive) {
      const [courier] = await db
        .select({ name: couriers.name })
        .from(couriers)
        .where(eq(couriers.id, route.courierId))
        .limit(1);
      const now = new Date().toISOString();
      await db
        .insert(deliveryAssignment)
        .values({
          id_transaksi: parsed.data.idTransaksi,
          kurir_id: route.courierId,
          kurir_name: courier?.name ?? null,
          status: 'Siap_Dikirim',
          route_id: id,
          created_at: now,
          updated_at: now,
        })
        .onConflictDoUpdate({
          target: deliveryAssignment.id_transaksi,
          set: { kurir_id: route.courierId, kurir_name: courier?.name ?? null, status: 'Siap_Dikirim', route_id: id, updated_at: now },
        });
      await db.update(transaksi).set({ order_status: 'shipping', updated_at: now }).where(eq(transaksi.id_transaksi, parsed.data.idTransaksi));
    }

    await db
      .update(deliveryRoutes)
      .set({ stopCount: (await db.select({ c: deliveryRoutePoint.sequence_no }).from(deliveryRoutePoint).where(eq(deliveryRoutePoint.route_id, id))).length, updatedAt: new Date().toISOString() })
      .where(eq(deliveryRoutes.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (unauthorized(error)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    console.error('[ADMIN_ROUTES_STOPS_POST]', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal menambah stop' }, { status: 500 });
  }
}