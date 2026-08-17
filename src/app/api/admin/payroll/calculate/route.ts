import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courierEarnings, couriers } from '@/lib/schema';
import { and, gte, lte, sql, desc } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';

export async function GET(req: Request) {
  try {
    await requireAdminRole('ledger:view');

    const url = new URL(req.url);
    const period = url.searchParams.get('period') ?? currentMonthParam();

    const start = `${period}-01 00:00:00`;
    const endExclusive = nextMonthStart(period);

    const rows = await db
      .select({
        courierId: courierEarnings.courierId,
        baseFee: sql<number>`sum(${courierEarnings.baseFee})`,
        bonusAmount: sql<number>`sum(${courierEarnings.bonusAmount})`,
        total: sql<number>`sum(${courierEarnings.baseFee} + ${courierEarnings.bonusAmount})`,
        count: sql<number>`count(*)`,
      })
      .from(courierEarnings)
      .where(
        and(
          gte(courierEarnings.createdAt, start),
          lte(courierEarnings.createdAt, endExclusive)
        )
      )
      .groupBy(courierEarnings.courierId)
      .orderBy(desc(sql`sum(${courierEarnings.baseFee} + ${courierEarnings.bonusAmount})`));

    const courierMeta = await db.select({ id: couriers.id, name: couriers.name }).from(couriers);
    const metaMap = new Map(courierMeta.map((c) => [c.id, c.name]));

    const payroll = rows.map((r) => ({
      courierId: r.courierId,
      courierName: metaMap.get(r.courierId) ?? null,
      totalDeliveryFee: Number(r.baseFee ?? 0),
      totalBonus: Number(r.bonusAmount ?? 0),
      total: Number(r.total ?? 0),
      deliveryCount: Number(r.count ?? 0),
      confirmedCount: Number(r.count ?? 0),
      paidOutCount: 0,
    }));

    const grand = payroll.reduce(
      (acc, p) => {
        acc.totalFee += p.totalDeliveryFee;
        acc.totalBonus += p.totalBonus;
        acc.total += p.total;
        acc.deliveryCount += p.deliveryCount;
        return acc;
      },
      { totalFee: 0, totalBonus: 0, total: 0, deliveryCount: 0 }
    );

    return NextResponse.json({
      ok: true,
      period,
      payroll,
      summary: {
        courierCount: payroll.length,
        totalDeliveryFee: grand.totalFee,
        totalBonus: grand.totalBonus,
        total: grand.total,
        totalDeliveries: grand.deliveryCount,
      },
    });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[ADMIN_PAYROLL_CALCULATE]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

function witaNow(): Date {
  return new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
}

function currentMonthParam(): string {
  const d = witaNow();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function nextMonthStart(period: string): string {
  const [y, m] = period.split('-').map((n) => parseInt(n, 10));
  const d = new Date(Date.UTC(y, m, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}-01 00:00:00`;
}
