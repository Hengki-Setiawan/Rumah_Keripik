import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shifts } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { requireCourierAuth } from '@/lib/courier-auth';
import { z } from 'zod';

const ClockInSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export async function POST(req: Request) {
  try {
    const courier = await requireCourierAuth(req);
    if (!courier) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = ClockInSchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid', details: body.error.flatten() }, { status: 400 });
    }

    const existingActive = await db.select()
      .from(shifts)
      .where(and(eq(shifts.courierId, courier.id), eq(shifts.status, 'active')))
      .limit(1);

    if (existingActive.length > 0) {
      return NextResponse.json({ ok: false, error: 'SHIFT_ALREADY_ACTIVE', shiftId: existingActive[0].id }, { status: 409 });
    }

    const result = await db.insert(shifts).values({
      courierId: courier.id,
      clockInLat: body.data.lat != null ? String(body.data.lat) : null,
      clockInLng: body.data.lng != null ? String(body.data.lng) : null,
      totalDistanceKm: 0,
      status: 'active',
    }).returning({ id: shifts.id, clockInAt: shifts.clockInAt });

    return NextResponse.json({ ok: true, data: { shiftId: result[0]?.id, clockInAt: result[0]?.clockInAt } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal clock-in' }, { status: 500 });
  }
}
