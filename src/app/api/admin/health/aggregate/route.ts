import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rateLimits, aiRuns, transaksi, paymentProof } from '@/lib/schema';
import { sql, gte, eq, and } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const now = Date.now();
  const lastHour = new Date(now - 3600000).toISOString();

  try {
    const [[rateLimitCount], [aiErrorCount], [todayOrders], [pendingVerifications]] = await Promise.all([
      db.select({ total: sql<number>`count(*)` }).from(rateLimits).where(gte(rateLimits.resetAt, now)),
      db.select({ total: sql<number>`count(*)` }).from(aiRuns).where(and(gte(aiRuns.createdAt, lastHour), eq(aiRuns.status, 'error'))),
      db.select({ total: sql<number>`count(*)` }).from(transaksi).where(gte(transaksi.waktu_simpan, lastHour)),
      db.select({ total: sql<number>`count(*)` }).from(paymentProof).where(eq(paymentProof.status, 'pending')),
    ]);

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      summary: {
        rateLimitActiveKeys: Number(rateLimitCount?.total || 0),
        aiErrorsLastHour: Number(aiErrorCount?.total || 0),
        ordersLastHour: Number(todayOrders?.total || 0),
        pendingPaymentVerifications: Number(pendingVerifications?.total || 0),
      },
      status: {
        rateLimiting: Number(rateLimitCount?.total || 0) < 100 ? 'healthy' : 'many_active_limits',
        aiErrors: Number(aiErrorCount?.total || 0) < 10 ? 'healthy' : 'elevated',
        paymentBacklog: Number(pendingVerifications?.total || 0) < 5 ? 'healthy' : 'backlog',
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Health aggregate failed' }, { status: 500 });
  }
}
