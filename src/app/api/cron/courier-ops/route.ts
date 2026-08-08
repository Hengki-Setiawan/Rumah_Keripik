import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courierPerformanceDaily, deliveryAssignment, couriers, shifts, notifications } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { validateCronRequest } from '@/lib/cron-auth';
import { sendCourierPushNotification } from '@/lib/expo-push';
import { witaToday } from '@/lib/wita-date';

export async function GET(req: Request) {
  const auth = validateCronRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const results: Record<string, unknown> = {};
  const date = witaToday();

  try {
    const aggregates = await db
      .select({
        courierId: deliveryAssignment.kurir_id,
        totalAssigned: sql<number>`count(*)`,
        totalCompleted: sql<number>`sum(case when ${deliveryAssignment.status} = 'Terkirim' then 1 else 0 end)`,
        totalFailed: sql<number>`sum(case when ${deliveryAssignment.status} = 'Gagal' then 1 else 0 end)`,
        totalDistance: sql<number>`sum(cast(coalesce(${deliveryAssignment.distance_actual_km}, '0') as real))`,
      })
      .from(deliveryAssignment)
      .where(sql`date(coalesce(${deliveryAssignment.delivered_at}, ${deliveryAssignment.updated_at})) = ${date}`)
      .groupBy(deliveryAssignment.kurir_id);

    let upserted = 0;
    for (const a of aggregates) {
      if (!a.courierId) continue;
      const assigned = Number(a.totalAssigned || 0);
      const completed = Number(a.totalCompleted || 0);
      const failed = Number(a.totalFailed || 0);
      const distance = Number(a.totalDistance || 0);
      const score = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;

      await db
        .insert(courierPerformanceDaily)
        .values({
          courierId: a.courierId,
          date,
          totalAssigned: assigned,
          totalCompleted: completed,
          totalFailed: failed,
          totalDistanceKm: distance,
          onTimeRate: assigned > 0 ? Math.round((completed / assigned) * 100) : 0,
          score,
        })
        .onConflictDoUpdate({
          target: [courierPerformanceDaily.courierId, courierPerformanceDaily.date],
          set: {
            totalAssigned: assigned,
            totalCompleted: completed,
            totalFailed: failed,
            totalDistanceKm: distance,
            onTimeRate: assigned > 0 ? Math.round((completed / assigned) * 100) : 0,
            score,
          },
        });
      upserted += 1;
    }
    results.performance = { date, upserted };
  } catch (error) {
    results.performanceError = error instanceof Error ? error.message : String(error);
  }

  try {
    const now = new Date();

    const clockedRows = await db
      .select({ courierId: shifts.courierId })
      .from(shifts)
      .where(
        and(
          sql`date(${shifts.clockInAt}, '+8 hours') = ${date}`,
          eq(shifts.status, 'active')
        )
      );

    const activeCouriers = await db
      .select({ id: couriers.id, name: couriers.name })
      .from(couriers)
      .where(eq(couriers.is_active, 1));

    const clockedIds = new Set(clockedRows.map((r) => r.courierId));
    const notClocked = activeCouriers.filter((c) => !clockedIds.has(c.id));

    let reminded = 0;
    for (const c of notClocked) {
      try {
        await db.insert(notifications).values({
          courierId: c.id,
          title: '⏰ Belum Clock-in',
          body: `Halo ${c.name || 'Kurir'}, jangan lupa clock-in sebelum mulai antar hari ini.`,
          type: 'system',
          createdAt: now.toISOString(),
        });
        await sendCourierPushNotification(c.id, '⏰ Belum Clock-in', 'Jangan lupa clock-in sebelum mulai antar hari ini.', { type: 'shift_reminder' }).catch(() => {});
        reminded += 1;
      } catch {
        // lanjut ke kurir berikutnya
      }
    }
    results.shiftReminder = { date, notClocked: notClocked.length, reminded };
  } catch (error) {
    results.shiftReminderError = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json({ ok: true, ...results });
}
