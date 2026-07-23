import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { aiRuns, botSetting } from '@/lib/schema';

const BUDGET_PERIOD_DAYS = 30;

export async function getProviderUsage(provider?: string) {
  const where = [];
  if (provider) where.push(eq(aiRuns.provider, provider));

  const since = new Date(Date.now() - BUDGET_PERIOD_DAYS * 86400000).toISOString();
  where.push(gte(aiRuns.createdAt, since));

  const rows = await db.select({
    provider: aiRuns.provider,
    totalTokens: sql<number>`COALESCE(SUM(${aiRuns.outputTokens}), 0)`,
    totalCalls: sql<number>`COUNT(*)`,
    errorCount: sql<number>`SUM(CASE WHEN ${aiRuns.status} = 'error' THEN 1 ELSE 0 END)`,
    totalLatencyMs: sql<number>`COALESCE(SUM(${aiRuns.latencyMs}), 0)`,
  }).from(aiRuns).where(and(...where)).groupBy(aiRuns.provider);

  return rows.map((r) => ({
    provider: r.provider,
    totalTokens: Number(r.totalTokens),
    totalCalls: Number(r.totalCalls),
    errorCount: Number(r.errorCount),
    avgLatencyMs: Number(r.totalCalls) > 0 ? Math.round(Number(r.totalLatencyMs) / Number(r.totalCalls)) : 0,
  }));
}

export async function getDailyUsage(days: number = 14) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const rows = await db.select({
    date: sql<string>`date(${aiRuns.createdAt})`,
    provider: aiRuns.provider,
    totalTokens: sql<number>`COALESCE(SUM(${aiRuns.outputTokens}), 0)`,
    totalCalls: sql<number>`COUNT(*)`,
  }).from(aiRuns).where(gte(aiRuns.createdAt, since)).groupBy(sql`date(${aiRuns.createdAt})`, aiRuns.provider).orderBy(sql`date(${aiRuns.createdAt})`);

  return rows.map((r) => ({
    date: r.date,
    provider: r.provider,
    totalTokens: Number(r.totalTokens),
    totalCalls: Number(r.totalCalls),
  }));
}

export async function getTaskDistribution() {
  const rows = await db.select({
    task: aiRuns.task,
    totalCalls: sql<number>`COUNT(*)`,
    errorCount: sql<number>`SUM(CASE WHEN ${aiRuns.status} = 'error' THEN 1 ELSE 0 END)`,
  }).from(aiRuns).groupBy(aiRuns.task).orderBy(sql`COUNT(*) DESC`).limit(20);

  return rows.map((r) => ({
    task: r.task,
    totalCalls: Number(r.totalCalls),
    errorCount: Number(r.errorCount),
    errorRate: Number(r.totalCalls) > 0 ? Number(r.errorCount) / Number(r.totalCalls) : 0,
  }));
}

export async function getOrSetDailyBudgetCap(capUsd?: number) {
  const key = 'ai.budget.daily_cap';
  const existing = await db.select().from(botSetting).where(eq(botSetting.key, key)).limit(1);

  if (capUsd != null) {
    await db.insert(botSetting).values({ key, value_json: String(capUsd), updated_at: new Date().toISOString() }).onConflictDoUpdate({
      target: botSetting.key,
      set: { value_json: String(capUsd), updated_at: new Date().toISOString() },
    });
    return { dailyCapUsd: capUsd };
  }

  return { dailyCapUsd: existing.length > 0 ? Number(existing[0].value_json) : null };
}
