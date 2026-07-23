import { eq, and, sql, desc, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  customerProfile, loyaltyAccounts, loyaltyLedger, referrals, transaksi,
} from '@/lib/schema';
import {
  generateIdLoyaltyAccount, generateIdLoyaltyLedger, generateIdReferral, generateReferralCode,
} from '@/lib/id-generator';

const POINTS_PER_REFERRAL_REFERRER = 5000;
const POINTS_PER_REFERRAL_REFEREE = 2500;
const MIN_REDEEM_POINTS = 10000;
const POINTS_PERCENT_OF_ORDER = 5;

const TIER_THRESHOLDS = [
  { tier: 'gold' as const, minPoints: 500000 },
  { tier: 'silver' as const, minPoints: 100000 },
  { tier: 'bronze' as const, minPoints: 0 },
];

function calculateTier(pointsBalance: number): 'bronze' | 'silver' | 'gold' {
  for (const t of TIER_THRESHOLDS) {
    if (pointsBalance >= t.minPoints) return t.tier;
  }
  return 'bronze';
}

export async function ensureLoyaltyAccount(customerId: string) {
  const existing = await db.select().from(loyaltyAccounts).where(eq(loyaltyAccounts.customerId, customerId)).limit(1);
  if (existing.length > 0) return existing[0];

  const id = generateIdLoyaltyAccount();
  const account = {
    id,
    customerId,
    pointsBalance: 0,
    tier: 'bronze' as const,
    referralCode: generateReferralCode(customerId),
  };
  await db.insert(loyaltyAccounts).values(account);
  return account;
}

export async function awardPoints(
  customerId: string,
  delta: number,
  reason: 'order_completed' | 'referral_bonus' | 'admin_adjustment',
  relatedOrderId?: string,
  note?: string,
) {
  const account = await ensureLoyaltyAccount(customerId);
  const newBalance = Math.max(0, account.pointsBalance + delta);
  const newTier = calculateTier(newBalance);

  const ledgerId = generateIdLoyaltyLedger();
  await db.insert(loyaltyLedger).values({
    id: ledgerId,
    accountId: account.id,
    delta,
    reason: reason as 'order_completed' | 'referral_bonus' | 'redeemed' | 'admin_adjustment',
    relatedOrderId: relatedOrderId || null,
    balanceAfter: newBalance,
    note: note || null,
  });

  await db.update(loyaltyAccounts).set({ pointsBalance: newBalance, tier: newTier }).where(eq(loyaltyAccounts.id, account.id));
  return { accountId: account.id, pointsAwarded: delta, newBalance, tier: newTier };
}

export async function redeemPoints(customerId: string, points: number, orderId: string) {
  if (points < MIN_REDEEM_POINTS) throw new Error(`Minimal redeem ${MIN_REDEEM_POINTS} poin`);

  const account = await ensureLoyaltyAccount(customerId);
  if (account.pointsBalance < points) throw new Error('Poin tidak mencukupi');
  if (points % 100 !== 0) throw new Error('Jumlah poin harus kelipatan 100');

  const newBalance = account.pointsBalance - points;
  const newTier = calculateTier(newBalance);

  const ledgerId = generateIdLoyaltyLedger();
  await db.insert(loyaltyLedger).values({
    id: ledgerId,
    accountId: account.id,
    delta: -points,
    reason: 'redeemed',
    relatedOrderId: orderId,
    balanceAfter: newBalance,
    note: `Redeem ${points} poin untuk order ${orderId}`,
  });

  await db.update(loyaltyAccounts).set({ pointsBalance: newBalance, tier: newTier }).where(eq(loyaltyAccounts.id, account.id));
  return { pointsRedeemed: points, newBalance, discountAmount: points };
}

export async function processReferral(code: string, refereeCustomerId: string) {
  const referral = await db.select().from(referrals).where(eq(referrals.code, code)).limit(1);
  if (referral.length === 0) throw new Error('Kode referral tidak ditemukan');
  if (referral[0].status !== 'pending') throw new Error('Kode referral sudah dipakai');
  if (referral[0].refereeCustomerId) throw new Error('Kode referral sudah digunakan');

  await db.update(referrals).set({ refereeCustomerId, status: 'used', usedAt: sql`(datetime('now', 'utc'))`, bonusPointsAwarded: POINTS_PER_REFERRAL_REFERRER }).where(eq(referrals.id, referral[0].id));

  await awardPoints(refereeCustomerId, POINTS_PER_REFERRAL_REFEREE, 'referral_bonus', undefined, `Bonus referral dari kode ${code}`);
  await awardPoints(referral[0].referrerAccountId, POINTS_PER_REFERRAL_REFERRER, 'referral_bonus', undefined, `Bonus referral untuk ${refereeCustomerId}`);

  return { referrerAwarded: POINTS_PER_REFERRAL_REFERRER, refereeAwarded: POINTS_PER_REFERRAL_REFEREE };
}

export async function awardPointsForCompletedOrder(customerId: string, orderId: string, totalBayar: number) {
  const points = Math.floor(totalBayar * POINTS_PERCENT_OF_ORDER / 100);
  if (points <= 0) return null;
  return awardPoints(customerId, points, 'order_completed', orderId, `Poin dari order ${orderId}`);
}

export async function getLoyaltyInfo(customerId: string) {
  const existing = await db.select().from(loyaltyAccounts).where(eq(loyaltyAccounts.customerId, customerId)).limit(1);
  if (existing.length === 0) {
    return { account: null, pointsHistory: [] };
  }
  const account = existing[0];
  const pointsHistory = await db.select().from(loyaltyLedger).where(eq(loyaltyLedger.accountId, account.id)).orderBy(desc(loyaltyLedger.createdAt)).limit(20);
  return { account, pointsHistory };
}

export async function getOrCreateReferralCode(customerId: string) {
  const account = await ensureLoyaltyAccount(customerId);
  const existing = await db.select().from(referrals).where(and(eq(referrals.referrerAccountId, account.id), eq(referrals.status, 'pending'))).limit(1);
  if (existing.length > 0) return existing[0];

  const id = generateIdReferral();
  await db.insert(referrals).values({
    id,
    referrerAccountId: account.id,
    code: account.referralCode,
    status: 'pending',
  });
  return { id, code: account.referralCode, status: 'pending' };
}
