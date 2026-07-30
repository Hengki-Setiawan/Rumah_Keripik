import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { couriers, shifts, notifications } from '@/lib/schema';
import { eq, and, sql, isNull } from 'drizzle-orm';
import { validateCronRequest } from '@/lib/cron-auth';
import { sendCourierPushNotification } from '@/lib/expo-push';

export async function GET(req: Request) {
  const auth = validateCronRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const today = new Date().toISOString().slice(0, 10);

    const activeCouriers = await db.select({ id: couriers.id, name: couriers.name })
      .from(couriers)
      .where(eq(couriers.is_active, 1));

    const reminded: { name: string | null; id: number }[] = [];

    for (const c of activeCouriers) {
      const [existing] = await db.select({ id: shifts.id })
        .from(shifts)
        .where(and(
          eq(shifts.courierId, c.id),
          sql`date(${shifts.clockInAt}) = ${today}`,
        ))
        .limit(1);

      if (existing) continue;

      await db.insert(notifications).values({
        courierId: c.id,
        title: 'Belum Clock-in',
        body: 'Halo! Kamu belum memulai shift hari ini. Jangan lupa clock-in ya.',
        type: 'shift_reminder',
        createdAt: sql`(datetime('now', 'utc'))`,
      });

      await sendCourierPushNotification(
        c.id,
        '⏰ Belum Clock-in',
        'Kamu belum memulai shift hari ini. Jangan lupa clock-in ya!',
        { type: 'shift_reminder' }
      );

      reminded.push({ name: c.name, id: c.id });
    }

    return NextResponse.json({
      ok: true,
      totalCouriers: activeCouriers.length,
      reminded: reminded.length,
      details: reminded.map(c => c.name),
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
