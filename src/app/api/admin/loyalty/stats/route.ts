import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { loyaltyAccounts, loyaltyLedger } from '@/lib/schema';
import { requireAdminRole, isUnauthorizedAdminError, isForbiddenAdminPermissionError } from '@/lib/admin-actor';

export async function GET() {
  try {
    await requireAdminRole('audit:read');
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ ok: false, error: 'Auth error' }, { status: 401 });
  }

  const totalAccounts = await db.select({ count: sql<number>`COUNT(*)` }).from(loyaltyAccounts);
  const bronze = await db.select({ count: sql<number>`COUNT(*)` }).from(loyaltyAccounts).where(eq(loyaltyAccounts.tier, 'bronze'));
  const silver = await db.select({ count: sql<number>`COUNT(*)` }).from(loyaltyAccounts).where(eq(loyaltyAccounts.tier, 'silver'));
  const gold = await db.select({ count: sql<number>`COUNT(*)` }).from(loyaltyAccounts).where(eq(loyaltyAccounts.tier, 'gold'));
  const issued = await db.select({ sum: sql<number>`COALESCE(SUM(${loyaltyLedger.delta}), 0)` }).from(loyaltyLedger).where(sql`${loyaltyLedger.delta} > 0 AND ${loyaltyLedger.reason} != 'redeemed'`);
  const redeemed = await db.select({ sum: sql<number>`COALESCE(SUM(${loyaltyLedger.delta}), 0)` }).from(loyaltyLedger).where(eq(loyaltyLedger.reason, 'redeemed'));

  return NextResponse.json({
    ok: true,
    stats: {
      totalAccounts: Number(totalAccounts[0]?.count || 0),
      tierDistribution: { bronze: Number(bronze[0]?.count || 0), silver: Number(silver[0]?.count || 0), gold: Number(gold[0]?.count || 0) },
      totalPointsIssued: Number(issued[0]?.sum || 0),
      totalPointsRedeemed: Math.abs(Number(redeemed[0]?.sum || 0)),
    },
  });
}
