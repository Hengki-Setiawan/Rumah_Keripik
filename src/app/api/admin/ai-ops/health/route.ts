import {NextResponse} from 'next/server';
import {eq, and, gte, sql} from 'drizzle-orm';
import {db} from '@/lib/db';
import {aiBudgetConfig, aiRuns} from '@/lib/schema';
import {requireAdminRole, isUnauthorizedAdminError, isForbiddenAdminPermissionError} from '@/lib/admin-actor';

export async function GET() {
  try {
    await requireAdminRole('audit:read');
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ ok: false, error: 'Auth error' }, { status: 401 });
  }

  const providers = ['gemini', 'cerebras', 'groq', 'qwen'];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const healthData = await Promise.all(providers.map(async (provider) => {
    const configs = await db.select().from(aiBudgetConfig).where(eq(aiBudgetConfig.provider, provider)).limit(1);
    const config = configs[0];

    const recentErrors = await db.select({ count: sql<number>`COUNT(*)` }).from(aiRuns)
      .where(and(eq(aiRuns.provider, provider), eq(aiRuns.status, 'error'), gte(aiRuns.createdAt, sevenDaysAgo)))
      .then((r) => Number(r[0]?.count || 0));

    const recentTotal = await db.select({ count: sql<number>`COUNT(*)` }).from(aiRuns)
      .where(and(eq(aiRuns.provider, provider), gte(aiRuns.createdAt, sevenDaysAgo)))
      .then((r) => Number(r[0]?.count || 0));

    const errorRate = recentTotal > 0 ? recentErrors / recentTotal : 0;

    const dailySpent = await db
      .select({ total: sql<number>`COALESCE(SUM(${aiRuns.costEstimateUsd}), 0)` })
      .from(aiRuns)
      .where(and(eq(aiRuns.provider, provider), gte(aiRuns.createdAt, todayStart.toISOString())))
      .then((r) => Number(r[0]?.total || 0) / 100);

    const status = errorRate > 0.3 ? 'down' : errorRate > 0.1 ? 'degraded' : 'healthy';
    const circuitBreaker = recentErrors >= 3 ? 'open' : recentErrors > 0 ? 'half-open' : 'closed';
    const budgetExhausted = config?.enabled && config.dailyBudgetUsd > 0 && dailySpent >= config.dailyBudgetUsd;

    return {
      provider,
      status,
      circuitBreaker,
      budgetExhausted: !!budgetExhausted,
      dailyBudget: config?.dailyBudgetUsd ?? undefined,
      dailySpent: Math.round(dailySpent * 100) / 100,
      lastCheck: new Date().toISOString(),
    };
  }));

  return NextResponse.json({ ok: true, data: healthData });
}