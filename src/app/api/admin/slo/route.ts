import {NextResponse} from 'next/server';
import {gte, sql} from 'drizzle-orm';
import {db} from '@/lib/db';
import {aiRuns, transaksi, deliveryAssignment} from '@/lib/schema';
import {requireAdminRole, isUnauthorizedAdminError, isForbiddenAdminPermissionError} from '@/lib/admin-actor';

export async function GET() {
  try {
    await requireAdminRole('audit:read');
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ ok: false, error: 'Auth error' }, { status: 401 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const aiLatency = await db
    .select({
      avgLatencyMs: sql<number>`COALESCE(AVG(${aiRuns.latencyMs}), 0)`,
      p95LatencyMs: sql<number>`COALESCE(
        (SELECT ${aiRuns.latencyMs} FROM ${aiRuns}
         WHERE ${aiRuns.createdAt} >= ${sevenDaysAgo}
         ORDER BY ${aiRuns.latencyMs} LIMIT 1 OFFSET CAST(COUNT(*) * 0.95 AS INT)
        ), 0)`,
      totalCalls: sql<number>`COUNT(*)`,
      errorCount: sql<number>`SUM(CASE WHEN ${aiRuns.status} = 'error' THEN 1 ELSE 0 END)`,
      fastCalls: sql<number>`SUM(CASE WHEN ${aiRuns.latencyMs} < 5000 THEN 1 ELSE 0 END)`,
    })
    .from(aiRuns)
    .where(gte(aiRuns.createdAt, sevenDaysAgo));

  const aiRow = aiLatency[0];
  const aiSloPass = aiRow && Number(aiRow.totalCalls) > 0
    ? (Number(aiRow.fastCalls) / Number(aiRow.totalCalls)) >= 0.95
    : true;

  const ordersLast7 = await db
    .select({
      total: sql<number>`COUNT(*)`,
      completed: sql<number>`SUM(CASE WHEN ${transaksi.order_status} = 'completed' THEN 1 ELSE 0 END)`,
    })
    .from(transaksi)
    .where(gte(transaksi.waktu_simpan, sevenDaysAgo));

  const ordRow = ordersLast7[0];
  const completionRate = ordRow && Number(ordRow.total) > 0
    ? Number(ordRow.completed) / Number(ordRow.total)
    : 1;

  const deliveriesLast7 = await db
    .select({
      total: sql<number>`COUNT(*)`,
      onTime: sql<number>`SUM(CASE WHEN ${deliveryAssignment.status} = 'Terkirim' THEN 1 ELSE 0 END)`,
    })
    .from(deliveryAssignment)
    .where(gte(deliveryAssignment.created_at, sevenDaysAgo));

  const delRow = deliveriesLast7[0];
  const deliverySuccessRate = delRow && Number(delRow.total) > 0
    ? Number(delRow.onTime) / Number(delRow.total)
    : 1;

  return NextResponse.json({
    ok: true,
    data: {
      aiChat: {
        avgLatencyMs: Math.round(Number(aiRow?.avgLatencyMs || 0)),
        p95LatencyMs: Math.round(Number(aiRow?.p95LatencyMs || 0)),
        totalCalls: Number(aiRow?.totalCalls || 0),
        errorRate: Number(aiRow?.totalCalls || 0) > 0 ? Number(aiRow?.errorCount || 0) / Number(aiRow?.totalCalls || 1) : 0,
        sloSatisfied: aiSloPass,
        sloTarget: '95% response <5dtk',
      },
      orderCompletion: {
        rate: Math.round(completionRate * 100),
        total: Number(ordRow?.total || 0),
        completed: Number(ordRow?.completed || 0),
        sloTarget: '> 90% completion',
        sloSatisfied: completionRate >= 0.9,
      },
      deliverySuccess: {
        rate: Math.round(deliverySuccessRate * 100),
        total: Number(delRow?.total || 0),
        delivered: Number(delRow?.onTime || 0),
        sloTarget: '> 85% delivered',
        sloSatisfied: deliverySuccessRate >= 0.85,
      },
    },
  });
}