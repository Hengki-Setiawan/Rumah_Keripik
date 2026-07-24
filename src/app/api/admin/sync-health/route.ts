import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courierSessions, courierEarnings } from '@/lib/schema';
import { sql, gte } from 'drizzle-orm';

export async function GET() {
  try {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const [onlineRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(courierSessions)
      .where(gte(courierSessions.last_active_at, fiveMinAgo));
    const [totalRow] = await db
      .select({ count: sql<number>`count(distinct ${courierEarnings.courierId})` })
      .from(courierEarnings);
    const couriers = await db
      .selectDistinct({ courierId: courierEarnings.courierId })
      .from(courierEarnings)
      .limit(20);
    return NextResponse.json({
      ok: true,
      totalCouriers: Number(totalRow?.count || 0),
      onlineNow: Number(onlineRow?.count || 0),
      offlineQueueTotal: 0,
      avgSyncDelaySeconds: 0,
      stuckItems: 0,
      couriers: couriers.map((c) => ({ id: c.courierId, name: c.courierId, queueSize: 0, lastSyncAt: '', status: 'unknown' })),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
