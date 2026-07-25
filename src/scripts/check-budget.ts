import { checkDailyBudget } from '@/services/budget-enforcer';

async function main() {
  const budget = await checkDailyBudget();
  console.log('=== Budget Check ===');
  console.log(`Spent today: $${budget.spentToday.toFixed(4)}`);
  console.log(`Daily cap: $${budget.capUsd.toFixed(2)}`);
  console.log(`Used: ${(budget.percentUsed * 100).toFixed(1)}%`);
  console.log(`Within budget: ${budget.withinBudget ? '✅' : '❌ OVER BUDGET'}`);
  process.exit(budget.withinBudget ? 0 : 1);
}
main().catch((err) => { console.error(err); process.exit(1); });