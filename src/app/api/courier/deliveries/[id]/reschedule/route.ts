import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, deliveryEvents, notifications } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireCourierAuth } from '@/lib/courier-auth';

const RescheduleSchema = z.object({
  requestedDate: z.string().min(1),
  reason: z.string().min(1),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const courier = await requireCourierAuth(req);
    if (!courier) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const deliveryId = Number(id);

    const [delivery] = await db.select()
      .from(deliveryAssignment)
      .where(eq(deliveryAssignment.id, deliveryId))
      .limit(1);

    if (!delivery) {
      return NextResponse.json({ ok: false, error: 'Pengiriman tidak ditemukan' }, { status: 404 });
    }

    if (delivery.kurir_id !== courier.id) {
      return NextResponse.json({ ok: false, error: 'Bukan tugas Anda' }, { status: 403 });
    }

    if (delivery.status !== 'Siap_Dikirim') {
      return NextResponse.json({ ok: false, error: 'Hanya bisa dijadwal ulang sebelum mulai antar' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = RescheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid', details: parsed.error.flatten() }, { status: 400 });
    }

    await db.insert(deliveryEvents).values({
      deliveryId,
      courierId: courier.id,
      eventType: 'note_added',
      lat: parsed.data.lat ? String(parsed.data.lat) : null,
      lng: parsed.data.lng ? String(parsed.data.lng) : null,
      metadata: JSON.stringify({
        action: 'reschedule_requested',
        requestedDate: parsed.data.requestedDate,
        reason: parsed.data.reason,
      }),
    });

    await db.insert(notifications).values({
      title: '🔄 Permintaan Jadwal Ulang',
      body: `Kurir ${courier.name || '-'} minta jadwal ulang #${delivery.id_transaksi} ke ${parsed.data.requestedDate}. Alasan: ${parsed.data.reason}`,
      type: 'system',
    });

    return NextResponse.json({
      ok: true,
      data: { message: 'Permintaan jadwal ulang dikirim ke admin' },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal' }, { status: 500 });
  }
}
