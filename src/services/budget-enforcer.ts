import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { aiRuns } from '@/lib/schema';

const DAILY_BUDGET_CAP_USD = 2.00;
const ALERT_THRESHOLD = 0.8;
const NOTIFICATION_WEBHOOK = process.env.SLACK_WEBHOOK_URL || process.env.TELEGRAM_ALERT_BOT;

export async function checkDailyBudget(): Promise<{
  withinBudget: boolean;
  spentToday: number;
  capUsd: number;
  percentUsed: number;
}> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const rows = await db.select({
    totalCost: sql<number>`COALESCE(SUM(${aiRuns.costEstimateUsd}), 0)`,
  }).from(aiRuns).where(sql`${aiRuns.createdAt} >= ${todayStart.toISOString()}`);

  const spentToday = Number(rows[0]?.totalCost || 0);
  const percentUsed = spentToday / DAILY_BUDGET_CAP_USD;

  if (percentUsed >= ALERT_THRESHOLD && percentUsed < 1) {
    await sendAlert(
      `⚠️ Budget AI ${(percentUsed * 100).toFixed(0)}% — $${spentToday.toFixed(4)} dari $${DAILY_BUDGET_CAP_USD}`,
    );
  }

  if (percentUsed >= 1) {
    await sendAlert(
      `🚨 BUDGET AI HABIS! Hari ini sudah $${spentToday.toFixed(4)}. Circuit breaker aktif.`,
    );
  }

  return {
    withinBudget: spentToday < DAILY_BUDGET_CAP_USD * 0.95,
    spentToday,
    capUsd: DAILY_BUDGET_CAP_USD,
    percentUsed,
  };
}

async function sendAlert(message: string) {
  if (NOTIFICATION_WEBHOOK) {
    try {
      await fetch(NOTIFICATION_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `[Rumah Keripik] ${message}` }),
      });
    } catch {}
  }
  console.warn(`[BudgetAlert] ${message}`);
}

export function shouldThrottleAi(percentUsed: number): boolean {
  if (percentUsed >= 1) return true;
  if (percentUsed >= 0.9) return Math.random() < 0.5;
  return false;
}

export async function getBudgetSnapshot() {
  const stats = await checkDailyBudget();
  return {
    ...stats,
    throttling: stats.percentUsed >= 0.9,
  };
}