import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { couriers, deliveryAssignment, courierPerformanceDaily, shifts } from '@/lib/schema';
import { eq, and, sql, gte, lte } from 'drizzle-orm';
import { validateCronRequest } from '@/lib/cron-auth';

export async function GET(req: Request) {
  const auth = validateCronRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const allCouriers = await db.select({ id: couriers.id, name: couriers.name })
      .from(couriers)
      .where(eq(couriers.is_active, 1));

    const results: { courierId: number; courierName: string | null; score: number }[] = [];

    for (const c of allCouriers) {
      const [agg] = await db.select({
        totalAssigned: sql<number>`count(*)`,
        totalCompleted: sql<number>`sum(case when ${deliveryAssignment.status} = 'Terkirim' then 1 else 0 end)`,
        totalFailed: sql<number>`sum(case when ${deliveryAssignment.status} = 'Gagal' then 1 else 0 end)`,
      })
        .from(deliveryAssignment)
        .where(and(
          eq(deliveryAssignment.kurir_id, c.id),
          sql`date(${deliveryAssignment.created_at}) = ${yesterday}`,
        ));

      const assigned = Number(agg?.totalAssigned || 0);
      const completed = Number(agg?.totalCompleted || 0);
      const failed = Number(agg?.totalFailed || 0);

      const [shiftAgg] = await db.select({
        totalHours: sql<number>`coalesce(sum(
          case when ${shifts.clockOutAt} is not null
            then (julianday(${shifts.clockOutAt}) - julianday(${shifts.clockInAt})) * 24
            else 0 end
        ), 0)`,
      })
        .from(shifts)
        .where(and(
          eq(shifts.courierId, c.id),
          sql`date(${shifts.clockInAt}) = ${yesterday}`,
        ));

      const completionRate = assigned > 0 ? completed / assigned : 0;
      const onTimeRate = completed > 0 ? 1 : 0;
      const incidentPenalty = 0;
      const speedBonus = 0;

      const score = Math.round(Math.min(100, Math.max(0,
        (onTimeRate * 40) + (completionRate * 40) + incidentPenalty + speedBonus
      )));

      await db.insert(courierPerformanceDaily).values({
        courierId: c.id,
        date: yesterday,
        totalAssigned: assigned,
        totalCompleted: completed,
        totalFailed: failed,
        onTimeRate,
        totalDistanceKm: 0,
        score,
      }).onConflictDoUpdate({
        target: [courierPerformanceDaily.courierId, courierPerformanceDaily.date],
        set: {
          totalAssigned: assigned,
          totalCompleted: completed,
          totalFailed: failed,
          onTimeRate,
          score,
        },
      });

      results.push({ courierId: c.id, courierName: c.name, score });
    }

    return NextResponse.json({
      ok: true,
      date: yesterday,
      processed: results.length,
      details: results,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
