import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, transaksi } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { requireCourierAuth } from '@/lib/courier-auth';
import { z } from 'zod';

const RespondSchema = z.object({
  assignmentId: z.number(),
  action: z.enum(['accept', 'reject']),
});

export async function POST(request: Request) {
  try {
    const courier = await requireCourierAuth(request);
    if (!courier) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = RespondSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid' }, { status: 400 });
    }

    const { assignmentId, action } = body.data;

    const [assignment] = await db
      .select()
      .from(deliveryAssignment)
      .where(eq(deliveryAssignment.id, assignmentId))
      .limit(1);

    if (!assignment) {
      return NextResponse.json({ ok: false, error: 'Pengiriman tidak ditemukan' }, { status: 404 });
    }

    if (assignment.kurir_id !== courier.id) {
      return NextResponse.json({ ok: false, error: 'Bukan tawaran untuk Anda' }, { status: 403 });
    }

    if (action === 'reject') {
      await db.delete(deliveryAssignment).where(eq(deliveryAssignment.id, assignmentId));
      await db
        .update(transaksi)
        .set({ order_status: 'ready', updated_at: new Date().toISOString() })
        .where(eq(transaksi.id_transaksi, assignment.id_transaksi));
    }

    return NextResponse.json({ ok: true, action });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
