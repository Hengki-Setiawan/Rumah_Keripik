import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sosEvents } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { sendCourierPushNotification } from '@/lib/expo-push';

const ResolveSchema = z.object({ id: z.number(), note: z.string().max(500).optional() });

export async function GET() {
  const events = await db
    .select()
    .from(sosEvents)
    .orderBy(desc(sosEvents.createdAt))
    .limit(50);
  return NextResponse.json({ ok: true, events });
}

export async function PATCH(req: Request) {
  const body = ResolveSchema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ ok: false, error: 'Data tidak valid' }, { status: 400 });

  const [event] = await db.select().from(sosEvents).where(eq(sosEvents.id, body.data.id)).limit(1);
  if (!event) return NextResponse.json({ ok: false, error: 'SOS tidak ditemukan' }, { status: 404 });

  await db.update(sosEvents).set({
    status: 'resolved',
    resolvedAt: new Date().toISOString(),
    note: body.data.note || null,
  }).where(eq(sosEvents.id, body.data.id));

  await sendCourierPushNotification(
    event.courierId,
    '✅ SOS Terselesaikan',
    body.data.note || 'Admin telah menandai sinyal darurat Anda sebagai selesai. Terima kasih.',
    { type: 'sos_resolved' }
  ).catch(() => {});

  return NextResponse.json({ ok: true });
}
