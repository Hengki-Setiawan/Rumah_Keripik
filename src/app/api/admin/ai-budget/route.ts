import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { aiBudgetConfig, aiRuns } from '@/lib/schema';
import { eq, gte, sum } from 'drizzle-orm';
import { requireAdminRole, isUnauthorizedAdminError } from '@/lib/admin-actor';

export async function GET() {
  try {
    await requireAdminRole('ledger:view');
    const budgets = await db.select().from(aiBudgetConfig);
    const now = new Date();

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const dailySpending = await db
      .select({ total: sum(aiRuns.costEstimateUsd), provider: aiRuns.provider })
      .from(aiRuns)
      .where(gte(aiRuns.createdAt, todayStart))
      .groupBy(aiRuns.provider);

    const monthlySpending = await db
      .select({ total: sum(aiRuns.costEstimateUsd), provider: aiRuns.provider })
      .from(aiRuns)
      .where(gte(aiRuns.createdAt, monthStart))
      .groupBy(aiRuns.provider);

    const enriched = budgets.map((b) => {
      const daily = Number(dailySpending.find((d) => d.provider === b.provider)?.total || 0);
      const monthly = Number(monthlySpending.find((m) => m.provider === b.provider)?.total || 0);
      return {
        ...b,
        dailySpentUsd: daily / 100,
        monthlySpentUsd: monthly / 100,
        dailyPercentUsed: b.dailyBudgetUsd > 0 ? (daily / (b.dailyBudgetUsd * 100)) * 100 : 0,
        monthlyPercentUsed: b.monthlyBudgetUsd > 0 ? (monthly / (b.monthlyBudgetUsd * 100)) * 100 : 0,
        alertTriggered: b.dailyBudgetUsd > 0 && (daily / (b.dailyBudgetUsd * 100)) * 100 >= b.alertThresholdPercent,
      };
    });

    return NextResponse.json({ ok: true, budgets: enriched });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) {
      return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminRole('ledger:write');
    const body = await req.json();
    const { provider, dailyBudgetUsd, monthlyBudgetUsd, enabled, alertThresholdPercent } = body;

    const existing = await db.select().from(aiBudgetConfig).where(eq(aiBudgetConfig.provider, provider)).limit(1);

    if (existing.length > 0) {
      await db.update(aiBudgetConfig).set({
        dailyBudgetUsd: dailyBudgetUsd ?? existing[0].dailyBudgetUsd,
        monthlyBudgetUsd: monthlyBudgetUsd ?? existing[0].monthlyBudgetUsd,
        enabled: enabled ?? existing[0].enabled,
        alertThresholdPercent: alertThresholdPercent ?? existing[0].alertThresholdPercent,
        updatedAt: new Date().toISOString(),
      }).where(eq(aiBudgetConfig.id, existing[0].id));
    } else {
      await db.insert(aiBudgetConfig).values({
        provider,
        dailyBudgetUsd: dailyBudgetUsd || 0,
        monthlyBudgetUsd: monthlyBudgetUsd || 0,
        enabled: enabled ?? true,
        alertThresholdPercent: alertThresholdPercent || 80,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) {
      return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal' }, { status: 500 });
  }
}
