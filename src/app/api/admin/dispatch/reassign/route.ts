import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { couriers, deliveryAssignment, transaksi, deliveryEvents } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';
import { sendCourierPushNotification, sendOrderPushNotification } from '@/lib/expo-push';
import { bumpCourierPerformanceDaily } from '@/lib/courier-earnings';
import { z } from 'zod';

const ReassignSchema = z.object({
  delivery_id: z.number(),
  kurir_id: z.number(),
  reason: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    await requireAdminRole('courier:manage');

    const body = await request.json();
    const parsed = ReassignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid', details: parsed.error.flatten() }, { status: 400 });
    }

    const [assignment] = await db
      .select()
      .from(deliveryAssignment)
      .where(eq(deliveryAssignment.id, parsed.data.delivery_id))
      .limit(1);

    if (!assignment) {
      return NextResponse.json({ ok: false, error: 'Pengiriman tidak ditemukan' }, { status: 404 });
    }

    const [target] = await db
      .select()
      .from(couriers)
      .where(and(eq(couriers.id, parsed.data.kurir_id), eq(couriers.is_active, 1)))
      .limit(1);

    if (!target) {
      return NextResponse.json({ ok: false, error: 'Kurir target tidak ditemukan atau tidak aktif' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const oldCourierId = assignment.kurir_id;
    const oldCourierName = assignment.kurir_name;

    await db
      .update(deliveryAssignment)
      .set({
        kurir_id: target.id,
        kurir_name: target.name,
        status: 'Siap_Dikirim',
        pickup_at: null,
        updated_at: now,
      })
      .where(eq(deliveryAssignment.id, parsed.data.delivery_id));

    await insertDeliveryEventSafe({
      deliveryId: parsed.data.delivery_id,
      courierId: target.id,
      eventType: 'reassigned',
      metadata: {
        id_transaksi: assignment.id_transaksi,
        fromCourierId: oldCourierId ?? null,
        fromCourierName: oldCourierName ?? null,
        reason: parsed.data.reason ?? null,
      },
    });

    await db
      .update(transaksi)
      .set({ order_status: 'shipping', updated_at: now })
      .where(eq(transaksi.id_transaksi, assignment.id_transaksi));

    const kode = assignment.kurir_name || 'pesanan';

    await sendCourierPushNotification(
      target.id,
      '🔄 Pengiriman Dialihkan',
      `Ada kiriman ${kode} untuk Anda. Segera ambil di gudang.`,
      { type: 'reassignment', id_transaksi: assignment.id_transaksi, delivery_id: String(parsed.data.delivery_id) }
    ).catch(() => {});

    if (oldCourierId) {
      await sendCourierPushNotification(
        oldCourierId,
        '🔄 Pengiriman Dialihkan',
        parsed.data.reason
          ? `${kode} dialihkan ke kurir lain. Alasan: ${parsed.data.reason}`
          : `${kode} telah dialihkan ke kurir lain.`,
        { type: 'reassignment', id_transaksi: assignment.id_transaksi, delivery_id: String(parsed.data.delivery_id) }
      ).catch(() => {});
    }

    await sendOrderPushNotification(assignment.id_transaksi, 'shipping').catch(() => {});

    try {
      await bumpCourierPerformanceDaily(target.id, 'assigned');
    } catch (perfErr) {
      console.error('[ADMIN_DISPATCH_REASSIGN_PERFORMANCE]', perfErr);
    }

    return NextResponse.json({
      ok: true,
      message: 'Pengiriman berhasil dialihkan',
      assignment: {
        id: assignment.id,
        id_transaksi: assignment.id_transaksi,
        previousCourierId: oldCourierId,
        previousCourierName: oldCourierName,
        newCourierId: target.id,
        newCourierName: target.name,
        status: 'Siap_Dikirim',
      },
    });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[ADMIN_DISPATCH_REASSIGN]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

async function insertDeliveryEventSafe(input: {
  deliveryId: number;
  courierId: number | null;
  eventType: 'reassigned';
  metadata: Record<string, unknown>;
}) {
  try {
    await db.insert(deliveryEvents).values({
      deliveryId: input.deliveryId,
      courierId: input.courierId,
      eventType: input.eventType,
      metadata: JSON.stringify(input.metadata),
    });
  } catch (err) {
    console.error('[ADMIN_DISPATCH_REASSIGN_EVENT]', err);
  }
}