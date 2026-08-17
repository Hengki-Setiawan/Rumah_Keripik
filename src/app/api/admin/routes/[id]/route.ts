import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryRoutes, deliveryRoutePoint, deliveryAssignment, transaksi, couriers } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';
import { z } from 'zod';
import { claimRoute, releaseRoute, startRoute, cancelRoute } from '@/lib/route-assign';

function unauthorized(error: unknown) {
  return error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION');
}

async function getRouteWithStops(id: number) {
  const [route] = await db.select().from(deliveryRoutes).where(eq(deliveryRoutes.id, id)).limit(1);
  if (!route) return null;
  const stops = await db
    .select({
      id: deliveryRoutePoint.id,
      idTransaksi: deliveryRoutePoint.id_transaksi,
      sequenceNo: deliveryRoutePoint.sequence_no,
      lat: deliveryRoutePoint.lat,
      lng: deliveryRoutePoint.lng,
      address: deliveryRoutePoint.address,
      kodePesanan: transaksi.kode_pesanan,
      penerima: transaksi.nama_penerima,
    })
    .from(deliveryRoutePoint)
    .leftJoin(transaksi, eq(deliveryRoutePoint.id_transaksi, transaksi.id_transaksi))
    .where(eq(deliveryRoutePoint.route_id, id))
    .orderBy(deliveryRoutePoint.sequence_no);
  return { route, stops };
}

const PatchSchema = z.object({
  routeName: z.string().optional(),
  warehouseId: z.number().optional(),
  courierId: z.number().nullable().optional(),
  capacityKg: z.number().nullable().optional(),
  status: z.enum(['open', 'claimed', 'in_progress', 'completed', 'cancelled']).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminRole('courier:manage');
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return NextResponse.json({ ok: false, error: 'ID tidak valid' }, { status: 400 });

    const [route] = await db.select().from(deliveryRoutes).where(eq(deliveryRoutes.id, id)).limit(1);
    if (!route) return NextResponse.json({ ok: false, error: 'Jalur tidak ditemukan' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'Data tidak valid' }, { status: 400 });

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updatedAt: now };

    if (parsed.data.routeName !== undefined) updates.routeName = parsed.data.routeName;
    if (parsed.data.warehouseId !== undefined) updates.warehouseId = parsed.data.warehouseId;
    if (parsed.data.capacityKg !== undefined) updates.capacityKg = parsed.data.capacityKg;

    // Claim/release kurir
    if (parsed.data.courierId !== undefined && parsed.data.courierId !== route.courierId) {
      if (parsed.data.courierId === null) {
        // Jangan force status 'open' bila release gagal (mis. jalur in_progress
        // ╬ô├Ñ├å releaseRoute melempar error). Error akan ditangkap di bawah dan
        // dikembalikan ke admin; status jalur tetap utuh.
        await releaseRoute(id, route.courierId ?? 0);
      } else {
        const [courier] = await db
          .select({ id: couriers.id, name: couriers.name })
          .from(couriers)
          .where(and(eq(couriers.id, parsed.data.courierId), eq(couriers.is_active, 1)))
          .limit(1);
        if (!courier) return NextResponse.json({ ok: false, error: 'Kurir tidak ditemukan atau tidak aktif' }, { status: 404 });
        // Reassign: lepas dari kurir lama dulu (bila ada), lalu claim ke kurir baru.
        if (route.courierId != null && route.courierId !== courier.id && route.status !== 'open') {
          await releaseRoute(id, route.courierId);
        }
        await claimRoute(id, courier.id, 'admin', courier.name);
      }
      return NextResponse.json({ ok: true, data: await getRouteWithStops(id) });
    }

    // Status transitif
    if (parsed.data.status) {
      if (parsed.data.status === 'cancelled') {
        await cancelRoute(id);
      } else if (parsed.data.status === 'in_progress' && route.courierId) {
        await startRoute(id, route.courierId);
      } else if (parsed.data.status === 'completed') {
        // Jangan izinkan jalur selesai bila masih ada stop belum selesai ╬ô├ç├╢
        // kalau tidak, order akan tertahan 'shipping' selamanya.
        const remaining = await db
          .select({ deliveryStatus: deliveryAssignment.status })
          .from(deliveryRoutePoint)
          .leftJoin(deliveryAssignment, eq(deliveryAssignment.id_transaksi, deliveryRoutePoint.id_transaksi))
          .where(eq(deliveryRoutePoint.route_id, id));
        const unfinished = remaining.filter(
          (s) => s.deliveryStatus !== 'Terkirim' && s.deliveryStatus !== 'Gagal'
        );
        if (unfinished.length > 0) {
          return NextResponse.json({
            ok: false,
            error: `Masih ada ${unfinished.length} stop belum selesai ╬ô├ç├╢ selesaikan semua pengiriman dulu atau batalkan jalur`,
          }, { status: 409 });
        }
        updates.status = 'completed';
        updates.completedAt = now;
        await db.update(deliveryRoutes).set(updates).where(eq(deliveryRoutes.id, id));
      } else {
        updates.status = parsed.data.status;
        await db.update(deliveryRoutes).set(updates).where(eq(deliveryRoutes.id, id));
      }
      return NextResponse.json({ ok: true, data: await getRouteWithStops(id) });
    }

    if (Object.keys(updates).length > 1) {
      await db.update(deliveryRoutes).set(updates).where(eq(deliveryRoutes.id, id));
    }

    return NextResponse.json({ ok: true, data: await getRouteWithStops(id) });
  } catch (error) {
    if (unauthorized(error)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    console.error('[ADMIN_ROUTES_PATCH]', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal update jalur' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminRole('courier:manage');
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return NextResponse.json({ ok: false, error: 'ID tidak valid' }, { status: 400 });

    const [route] = await db.select().from(deliveryRoutes).where(eq(deliveryRoutes.id, id)).limit(1);
    if (!route) return NextResponse.json({ ok: false, error: 'Jalur tidak ditemukan' }, { status: 404 });

    // Jangan biarkan hapus jalur yang sudah punya stop Terkirim/Gagal ╬ô├ç├╢ riwayat
    // & revenue sudah tercatat. Admin harus pakai "Selesai"/"Batalkan" saja.
    const finished = await db
      .select({ status: deliveryAssignment.status })
      .from(deliveryRoutePoint)
      .leftJoin(deliveryAssignment, eq(deliveryAssignment.id_transaksi, deliveryRoutePoint.id_transaksi))
      .where(eq(deliveryRoutePoint.route_id, id));
    const hasFinished = finished.some((s) => s.status === 'Terkirim' || s.status === 'Gagal');
    if (hasFinished) {
      return NextResponse.json({ ok: false, error: 'Jalur sudah ada pengiriman selesai ╬ô├ç├╢ tidak bisa dihapus. Batalkan atau tandai selesai.' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const stops = await db.select({ idTransaksi: deliveryRoutePoint.id_transaksi }).from(deliveryRoutePoint).where(eq(deliveryRoutePoint.route_id, id));

    for (const stop of stops) {
      await db.delete(deliveryAssignment).where(eq(deliveryAssignment.id_transaksi, stop.idTransaksi));
      await db.update(transaksi).set({ order_status: 'processing', updated_at: now }).where(eq(transaksi.id_transaksi, stop.idTransaksi));
    }
    await db.delete(deliveryRoutePoint).where(eq(deliveryRoutePoint.route_id, id));
    await db.delete(deliveryRoutes).where(eq(deliveryRoutes.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (unauthorized(error)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    console.error('[ADMIN_ROUTES_DELETE]', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Terjadi kesalahan server' }, { status: 500 });
  }
}
