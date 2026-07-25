import { checkDailyBudget, shouldThrottleAi } from './budget-enforcer';

export async function withBudgetGuard<T>(fn: () => Promise<T>): Promise<T | null> {
  const budget = await checkDailyBudget();

  if (shouldThrottleAi(budget.percentUsed)) {
    console.warn(`[BudgetGuard] Throttled — ${(budget.percentUsed * 100).toFixed(0)}% used`);
    return null;
  }

  return fn();
}