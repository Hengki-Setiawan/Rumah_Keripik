import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { couriers, courierPerformanceDaily, notifications } from '@/lib/schema';
import { eq, and, sql, gte, lte } from 'drizzle-orm';
import { validateCronRequest } from '@/lib/cron-auth';
import { sendCourierPushNotification } from '@/lib/expo-push';

export async function GET(req: Request) {
  const auth = validateCronRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const allCouriers = await db.select({ id: couriers.id, name: couriers.name })
      .from(couriers)
      .where(eq(couriers.is_active, 1));

    const pushed: { name: string | null; completed: number }[] = [];

    for (const c of allCouriers) {
      const [agg] = await db.select({
        totalCompleted: sql<number>`coalesce(sum(${courierPerformanceDaily.totalCompleted}), 0)`,
        totalFailed: sql<number>`coalesce(sum(${courierPerformanceDaily.totalFailed}), 0)`,
        avgScore: sql<number>`coalesce(avg(${courierPerformanceDaily.score}), 0)`,
      })
        .from(courierPerformanceDaily)
        .where(and(
          eq(courierPerformanceDaily.courierId, c.id),
          gte(courierPerformanceDaily.date, weekAgo),
          lte(courierPerformanceDaily.date, yesterday),
        ));

      const completed = Number(agg?.totalCompleted || 0);
      const failed = Number(agg?.totalFailed || 0);
      const score = Math.round(Number(agg?.avgScore || 0) * 10) / 10;

      if (completed === 0 && failed === 0) continue;

      const body = `Minggu ini: ${completed} selesai, ${failed} gagal. Skor: ${score}.`;

      await db.insert(notifications).values({
        courierId: c.id,
        title: '📊 Ringkasan Performa Mingguan',
        body,
        type: 'performance',
        createdAt: sql`(datetime('now', 'utc'))`,
      });

      await sendCourierPushNotification(
        c.id,
        '📊 Ringkasan Performa Minggu Ini',
        body,
        { type: 'weekly_summary' }
      );

      pushed.push({ name: c.name, completed });
    }

    return NextResponse.json({
      ok: true,
      period: { from: weekAgo, to: yesterday },
      pushed: pushed.length,
      details: pushed,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
