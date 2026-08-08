import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courierPerformanceDaily } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { verifyCourierAuth } from '@/lib/courier/auth';

export async function GET(req: Request) {
  try {
    const auth = await verifyCourierAuth(req);
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const period = url.searchParams.get('period') || 'week';
    const days = period === 'month' ? 30 : 7;

    const performance = await db.select()
      .from(courierPerformanceDaily)
      .where(and(
        eq(courierPerformanceDaily.courierId, auth.courierId),
        sql`date(${courierPerformanceDaily.date}) >= date(datetime('now', '+8 hours'), '-' || ${days} || ' days')`,
      ));

    const totalAssigned = performance.reduce((s, r) => s + (r.totalAssigned || 0), 0);
    const totalCompleted = performance.reduce((s, r) => s + (r.totalCompleted || 0), 0);
    const totalFailed = performance.reduce((s, r) => s + (r.totalFailed || 0), 0);
    const avgRate = performance.length > 0
      ? performance.reduce((s, r) => s + (r.onTimeRate || 0), 0) / performance.length
      : 0;
    const totalDistance = performance.reduce((s, r) => s + (r.totalDistanceKm || 0), 0);
    const totalIncidents = performance.reduce((s, r) => s + (r.incidentCount || 0), 0);

    const allCouriersScore = await db.select({
      courierId: courierPerformanceDaily.courierId,
      score: sql<number>`sum(${courierPerformanceDaily.score})`,
    })
      .from(courierPerformanceDaily)
      .where(sql`date(${courierPerformanceDaily.date}) >= date(datetime('now', '+8 hours'), '-' || ${days} || ' days')`)
      .groupBy(courierPerformanceDaily.courierId)
      .orderBy(sql`sum(${courierPerformanceDaily.score}) desc`);

    const myScore = performance.reduce((s, r) => s + (r.score || 0), 0);
    const rank = allCouriersScore.findIndex((c) => c.courierId === auth.courierId) + 1;

    return NextResponse.json({
      ok: true,
      data: {
        period,
        totalAssigned,
        totalCompleted,
        totalFailed,
        onTimeRate: Math.round(avgRate * 100) / 100,
        totalDistanceKm: Math.round(totalDistance * 10) / 10,
        incidentCount: totalIncidents,
        score: Math.round(myScore),
        rank,
        totalCouriers: allCouriersScore.length,
        completionRate: totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal ambil statistik' }, { status: 500 });
  }
}
