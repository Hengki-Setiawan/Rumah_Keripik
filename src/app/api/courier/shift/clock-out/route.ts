import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shifts, deliveryAssignment } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { requireCourierAuth } from '@/lib/courier-auth';
import { z } from 'zod';

const ClockOutSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export async function POST(req: Request) {
  try {
    const courier = await requireCourierAuth(req);
    if (!courier) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = ClockOutSchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid', details: body.error.flatten() }, { status: 400 });
    }

    const [activeShift] = await db.select()
      .from(shifts)
      .where(and(eq(shifts.courierId, courier.id), eq(shifts.status, 'active')))
      .limit(1);

    if (!activeShift) {
      return NextResponse.json({ ok: false, error: 'SHIFT_NOT_ACTIVE' }, { status: 400 });
    }

    const deliveries = await db.select({ count: sql<number>`count(*)` })
      .from(deliveryAssignment)
      .where(and(
        eq(deliveryAssignment.kurir_id, courier.id),
        sql`date(${deliveryAssignment.created_at}) = date('now')`,
        eq(deliveryAssignment.status, 'Terkirim'),
      ));

    const now = new Date().toISOString();
    await db.update(shifts).set({
      clockOutAt: now,
      clockOutLat: body.data.lat != null ? String(body.data.lat) : null,
      clockOutLng: body.data.lng != null ? String(body.data.lng) : null,
      totalDeliveries: Number(deliveries[0]?.count || 0),
      status: 'ended',
    }).where(eq(shifts.id, activeShift.id));

    return NextResponse.json({
      ok: true,
      data: {
        shiftId: activeShift.id,
        clockInAt: activeShift.clockInAt,
        clockOutAt: now,
        totalDeliveries: Number(deliveries[0]?.count || 0),
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal clock-out' }, { status: 500 });
  }
}
