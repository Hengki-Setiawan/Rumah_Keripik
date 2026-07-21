import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment } from '@/lib/schema';
import { requireCourierAuth } from '@/lib/courier-auth';
import { eq, and } from 'drizzle-orm';

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

    if (assignment.status !== 'Siap_Dikirim') {
      return NextResponse.json({ ok: false, error: 'Status pengiriman tidak valid untuk diambil' }, { status: 400 });
    }

    const now = new Date().toISOString();
    await db
      .update(deliveryAssignment)
      .set({
        status: 'Dalam_Pengiriman',
        pickup_at: now,
        updated_at: now,
      })
      .where(eq(deliveryAssignment.id, deliveryId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[COURIER_DELIVERY_START]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
