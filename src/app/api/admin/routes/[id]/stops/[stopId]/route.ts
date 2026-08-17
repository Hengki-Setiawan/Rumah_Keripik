import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryRoutes, deliveryRoutePoint, deliveryAssignment, transaksi } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';
import { routeTotalKm } from '@/lib/courier/routing';

function unauthorized(error: unknown) {
  return error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION');
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; stopId: string }> }) {
  try {
    await requireAdminRole('courier:manage');
    const { id: idStr, stopId: stopIdStr } = await params;
    const id = parseInt(idStr, 10);
    const stopId = parseInt(stopIdStr, 10);
    if (isNaN(id) || isNaN(stopId)) return NextResponse.json({ ok: false, error: 'ID tidak valid' }, { status: 400 });

    const [route] = await db.select().from(deliveryRoutes).where(eq(deliveryRoutes.id, id)).limit(1);
    if (!route) return NextResponse.json({ ok: false, error: 'Jalur tidak ditemukan' }, { status: 404 });

    const [stop] = await db
      .select({
        id: deliveryRoutePoint.id,
        id_transaksi: deliveryRoutePoint.id_transaksi,
        deliveryStatus: deliveryAssignment.status,
      })
      .from(deliveryRoutePoint)
      .leftJoin(deliveryAssignment, eq(deliveryAssignment.id_transaksi, deliveryRoutePoint.id_transaksi))
      .where(and(eq(deliveryRoutePoint.id, stopId), eq(deliveryRoutePoint.route_id, id)))
      .limit(1);
    if (!stop) return NextResponse.json({ ok: false, error: 'Stop tidak ditemukan' }, { status: 404 });

    // Stop yang sudah Terkirim/Gagal tidak boleh dihapus dari jalur — riwayat
    // & revenue sudah tercatat; urutannya sudah selesai.
    if (stop.deliveryStatus === 'Terkirim' || stop.deliveryStatus === 'Gagal') {
      return NextResponse.json({ ok: false, error: 'Stop sudah selesai — tidak bisa dihapus dari jalur' }, { status: 409 });
    }

    const now = new Date().toISOString();
    await db.delete(deliveryAssignment).where(eq(deliveryAssignment.id_transaksi, stop.id_transaksi));
    await db.update(transaksi).set({ order_status: 'processing', updated_at: now }).where(eq(transaksi.id_transaksi, stop.id_transaksi));
    await db.delete(deliveryRoutePoint).where(eq(deliveryRoutePoint.id, stopId));

    const remaining = await db
      .select()
      .from(deliveryRoutePoint)
      .where(eq(deliveryRoutePoint.route_id, id))
      .orderBy(deliveryRoutePoint.sequence_no);
    for (const [i, p] of remaining.entries()) {
      await db.update(deliveryRoutePoint).set({ sequence_no: i + 1 }).where(eq(deliveryRoutePoint.id, p.id));
    }

    const withCoord = remaining.filter((p) => p.lat && p.lng).map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
    await db
      .update(deliveryRoutes)
      .set({ stopCount: remaining.length, estimatedDistanceKm: String(routeTotalKm(withCoord)), updatedAt: now })
      .where(eq(deliveryRoutes.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (unauthorized(error)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    console.error('[ADMIN_ROUTES_STOPS_DELETE]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}