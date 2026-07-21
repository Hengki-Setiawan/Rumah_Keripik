import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, orderEvents, transaksi } from '@/lib/schema';
import { requireCourierAuth } from '@/lib/courier-auth';
import { CourierFailDeliverySchema } from '@/lib/courier-types';
import { eq, and } from 'drizzle-orm';
import { sendOrderPushNotification } from '@/lib/expo-push';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const courier = await requireCourierAuth(request);
    if (!courier) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const deliveryId = parseInt(id, 10);
    if (isNaN(deliveryId)) {
      return NextResponse.json({ ok: false, error: 'ID tidak valid' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = CourierFailDeliverySchema.safeParse({ delivery_id: deliveryId, ...body });
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid', details: parsed.error.flatten() }, { status: 400 });
    }

    const [assignment] = await db
      .select()
      .from(deliveryAssignment)
      .where(
        and(
          eq(deliveryAssignment.id, deliveryId),
          eq(deliveryAssignment.kurir_id, courier.id)
        )
      )
      .limit(1);

    if (!assignment) {
      return NextResponse.json({ ok: false, error: 'Pengiriman tidak ditemukan' }, { status: 404 });
    }

    if (assignment.status !== 'Dalam_Pengiriman') {
      return NextResponse.json({ ok: false, error: 'Pengiriman harus dalam status pengiriman' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const failNote = `GAGAL: ${parsed.data.reason}${parsed.data.notes ? ` | ${parsed.data.notes}` : ''}`;

    await db
      .update(deliveryAssignment)
      .set({
        status: 'Gagal',
        notes: failNote,
        proof_url: parsed.data.proof_photo_url || assignment.proof_url,
        updated_at: now,
      })
      .where(eq(deliveryAssignment.id, deliveryId));

    await db
      .update(transaksi)
      .set({ order_status: 'cancelled', updated_at: now })
      .where(eq(transaksi.id_transaksi, assignment.id_transaksi));

    const [tx] = await db
      .select({ no_wa: transaksi.no_wa })
      .from(transaksi)
      .where(eq(transaksi.id_transaksi, assignment.id_transaksi))
      .limit(1);

    if (tx?.no_wa) {
      await db.insert(orderEvents).values({
        no_wa_pelanggan: tx.no_wa,
        id_transaksi: assignment.id_transaksi,
        event_type: 'DELIVERY_FAILED',
        event_payload: JSON.stringify({ reason: parsed.data.reason, notes: parsed.data.notes, courier_name: assignment.kurir_name, delivery_id: deliveryId }),
      });
    }

    await sendOrderPushNotification(assignment.id_transaksi, 'cancelled');

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[COURIER_DELIVERY_FAIL]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
