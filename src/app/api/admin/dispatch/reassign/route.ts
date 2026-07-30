import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, couriers, notifications, deliveryEvents } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';
import { sendCourierPushNotification } from '@/lib/expo-push';

export async function POST(req: Request) {
  try {
    await requireAdminRole('order:update');

    const { deliveryId, newKurirId } = await req.json();
    if (!deliveryId || !newKurirId) {
      return NextResponse.json({ ok: false, error: 'deliveryId dan newKurirId required' }, { status: 400 });
    }

    const [delivery] = await db.select()
      .from(deliveryAssignment)
      .where(eq(deliveryAssignment.id, deliveryId))
      .limit(1);

    if (!delivery) return NextResponse.json({ ok: false, error: 'Delivery not found' }, { status: 404 });

    const [newCourier] = await db
      .select({ name: couriers.name })
      .from(couriers)
      .where(eq(couriers.id, newKurirId))
      .limit(1);

    const oldKurirId = delivery.kurir_id;

    await db.update(deliveryAssignment).set({
      kurir_id: newKurirId,
      kurir_name: newCourier?.name || delivery.kurir_name,
    }).where(eq(deliveryAssignment.id, deliveryId));

    await db.insert(deliveryEvents).values({
      deliveryId,
      courierId: newKurirId,
      eventType: 'reassigned',
      metadata: JSON.stringify({ oldKurirId, newKurirId }),
    });

    await db.insert(notifications).values({
      courierId: newKurirId,
      title: 'Pengalihan Tugas',
      body: `Ada kiriman baru dialihkan ke Anda. Kode: ${delivery.id_transaksi}`,
      type: 'reassignment',
      isRead: false,
      relatedDeliveryId: deliveryId,
    });

    await sendCourierPushNotification(
      newKurirId,
      '🔄 Pengalihan Tugas',
      `Kiriman ${delivery.id_transaksi} dialihkan ke Anda.`,
      { type: 'reassignment', id_transaksi: delivery.id_transaksi }
    );

    if (oldKurirId && oldKurirId !== newKurirId) {
      await sendCourierPushNotification(
        oldKurirId,
        '🔄 Tugas Dialihkan',
        `Kiriman ${delivery.id_transaksi} sudah tidak menjadi tugas Anda.`,
        { type: 'reassignment_removed', id_transaksi: delivery.id_transaksi }
      );
    }

    return NextResponse.json({ ok: true, data: { message: `Reassigned from ${oldKurirId || '-'} to ${newKurirId}` } });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal reassign' }, { status: 500 });
  }
}
