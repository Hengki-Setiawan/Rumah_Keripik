import { eq, and, sql, gte, lte, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { expenseCategories, ledgerEntries, cashReconciliation } from '@/lib/schema';
import { generateIdExpenseCategory, generateIdLedgerEntry, generateIdCashReconciliation } from '@/lib/id-generator';
const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Bahan Baku', type: 'cogs' as const },
  { name: 'Ongkos Kurir', type: 'operational' as const },
  { name: 'Kemasan', type: 'cogs' as const },
  { name: 'Marketing & Promosi', type: 'marketing' as const },
  { name: 'Sewa Tempat', type: 'operational' as const },
  { name: 'Listrik & Air', type: 'operational' as const },
  { name: 'Lain-lain', type: 'other' as const },
];

export async function ensureDefaultCategories() {
  const existing = await db.select().from(expenseCategories).limit(1);
  if (existing.length > 0) return;

  const values = DEFAULT_EXPENSE_CATEGORIES.map((cat) => ({
    id: generateIdExpenseCategory(),
    name: cat.name,
    type: cat.type,
  }));
  await db.insert(expenseCategories).values(values);
  return values;
}

export async function getCategories() {
  const cats = await db.select().from(expenseCategories).orderBy(expenseCategories.name);
  if (cats.length === 0) return ensureDefaultCategories();
  return cats;
}

export async function recordRevenue(orderId: string, amount: number, note?: string) {
  // Idempotensi: jangan mencatat revenue untuk order yang sudah tercatat.
  if (orderId) {
    const existing = await db
      .select({ id: ledgerEntries.id })
      .from(ledgerEntries)
      .where(and(eq(ledgerEntries.relatedOrderId, orderId), eq(ledgerEntries.entryType, 'revenue')))
      .limit(1);
    if (existing.length > 0) return { id: existing[0].id, entryType: 'revenue' as const, amount, duplicated: true };
  }

  const id = generateIdLedgerEntry();
  await db.insert(ledgerEntries).values({
    id,
    entryType: 'revenue',
    amount,
    relatedOrderId: orderId,
    note: note || `Pendapatan dari order ${orderId}`,
    createdBy: 'system',
  });
  return { id, entryType: 'revenue', amount, duplicated: false };
}

export async function recordExpense(categoryId: string, amount: number, note: string, createdBy: string) {
  const cat = await db.select().from(expenseCategories).where(eq(expenseCategories.id, categoryId)).limit(1);
  if (cat.length === 0) throw new Error('Kategori biaya tidak ditemukan');

  const id = generateIdLedgerEntry();
  await db.insert(ledgerEntries).values({
    id,
    entryType: 'expense',
    amount: -amount,
    categoryId,
    note,
    createdBy,
  });
  return { id, entryType: 'expense', amount: -amount };
}

export async function recordRefund(orderId: string, amount: number, note?: string) {
  const id = generateIdLedgerEntry();
  await db.insert(ledgerEntries).values({
    id,
    entryType: 'refund',
    amount: -amount,
    relatedOrderId: orderId,
    note: note || `Refund order ${orderId}`,
    createdBy: 'system',
  });
  return { id, entryType: 'refund', amount: -amount };
}

export async function getPeriodReport(periodStart: string, periodEnd: string) {
  const entries = await db.select().from(ledgerEntries).where(
    and(gte(ledgerEntries.createdAt, periodStart), lte(ledgerEntries.createdAt, periodEnd + 'T23:59:59Z')),
  ).orderBy(desc(ledgerEntries.createdAt));

  const totalRevenue = entries.filter((e) => e.entryType === 'revenue').reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = entries.filter((e) => e.entryType === 'expense').reduce((sum, e) => sum + Math.abs(e.amount), 0);
  const totalRefunds = entries.filter((e) => e.entryType === 'refund').reduce((sum, e) => sum + Math.abs(e.amount), 0);
  const totalAdjustments = entries.filter((e) => e.entryType === 'adjustment').reduce((sum, e) => sum + e.amount, 0);

  const byCategory = entries.filter((e) => e.entryType === 'expense' && e.categoryId).reduce<Record<string, number>>((acc, e) => {
    acc[e.categoryId!] = (acc[e.categoryId!] || 0) + Math.abs(e.amount);
    return acc;
  }, {});

  return {
    periodStart,
    periodEnd,
    totalRevenue,
    totalExpenses,
    totalRefunds,
    totalAdjustments,
    netProfit: totalRevenue - totalExpenses - totalRefunds + totalAdjustments,
    entryCount: entries.length,
    entries,
    expenseByCategory: byCategory,
  };
}

export async function createReconciliation(periodStart: string, periodEnd: string, actualBalance: number | null, performedBy: string) {
  const report = await getPeriodReport(periodStart, periodEnd);

  const id = generateIdCashReconciliation();
  await db.insert(cashReconciliation).values({
    id,
    periodStart,
    periodEnd,
    systemBalance: report.netProfit,
    actualBalance,
    reconciledBy: performedBy,
    reconciledAt: actualBalance != null ? sql`(datetime('now', 'utc'))` : null,
  });
  return { id, systemBalance: report.netProfit, actualBalance };
}

/**
 * Retry terpisah untuk integrasi pasca-complete yang gagal (poin loyalty +
 * pencatatan revenue). Kedua operasi idempoten:
 *  - awardPointsForCompletedOrder menolak bila ledger poin sudah ada.
 *  - recordRevenue menolak bila entry revenue sudah ada.
 * Dipanggil oleh worker job `revenue_payout`.
 */
export async function processRevenuePayoutJob(payload: Record<string, unknown>) {
  const orderId = typeof payload.orderId === 'string' ? payload.orderId : null;
  const customerId = payload.customerId && typeof payload.customerId === 'string' ? payload.customerId : null;
  const totalBayar = typeof payload.totalBayar === 'number' ? payload.totalBayar : null;

  if (!orderId || totalBayar == null) {
    throw new Error('orderId dan totalBayar wajib ada');
  }

  const results: Record<string, unknown> = {};
  if (customerId) {
    const { awardPointsForCompletedOrder } = await import('@/services/loyalty-service');
    results.loyalty = await awardPointsForCompletedOrder(customerId, orderId, totalBayar);
  }
  await ensureDefaultCategories();
  results.revenue = await recordRevenue(orderId, totalBayar, `Pendapatan dari order ${orderId} (retry worker)`);
  return results;
}
