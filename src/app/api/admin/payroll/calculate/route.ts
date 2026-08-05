import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courierEarnings, couriers, shifts } from '@/lib/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
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
        status: courierEarnings.status,
      })
      .from(courierEarnings)
      .where(
        and(
          gte(courierEarnings.createdAt, start),
          lte(courierEarnings.createdAt, endExclusive)
        )
      )
      .groupBy(courierEarnings.courierId, courierEarnings.status)
      .orderBy(desc(sql`sum(${courierEarnings.baseFee} + ${courierEarnings.bonusAmount})`));

    const courierMeta = await db.select({ id: couriers.id, name: couriers.name }).from(couriers);

    const metaMap = new Map(courierMeta.map((c) => [c.id, c.name]));

    const perCourier = new Map<number, {
      courierId: number;
      courierName: string | null;
      baseFee: number;
      bonusAmount: number;
      total: number;
      deliveryCount: number;
      pending: number;
      confirmed: number;
      paidOut: number;
    }>();

    for (const r of rows) {
      const key = r.courierId;
      const e = perCourier.get(key) ?? {
        courierId: key,
        courierName: metaMap.get(key) ?? null,
        baseFee: 0,
        bonusAmount: 0,
        total: 0,
        deliveryCount: 0,
        pending: 0,
        confirmed: 0,
        paidOut: 0,
      };
      e.baseFee += Number(r.baseFee ?? 0);
      e.bonusAmount += Number(r.bonusAmount ?? 0);
      e.total += Number(r.total ?? 0);
      e.deliveryCount += Number(r.count ?? 0);
      if (r.status === 'pending') e.pending = Number(r.count ?? 0);
      else if (r.status === 'confirmed') e.confirmed = Number(r.count ?? 0);
      else if (r.status === 'paid_out') e.paidOut = Number(r.count ?? 0);
      perCourier.set(key, e);
    }

    const shiftsSummary = await db
      .select({
        courierId: shifts.courierId,
        totalShifts: sql<number>`count(*)`,
        totalDistance: sql<number>`sum(${shifts.totalDistanceKm})`,
      })
      .from(shifts)
      .where(
        and(
          gte(shifts.clockInAt, start),
          lte(shifts.clockInAt, endExclusive),
          eq(shifts.status, 'ended')
        )
      )
      .groupBy(shifts.courierId);

    const shiftMap = new Map(shiftsSummary.map((s) => [s.courierId, s]));

    const payroll = Array.from(perCourier.values()).map((e) => ({
      courierId: e.courierId,
      courierName: e.courierName,
      totalDeliveryFee: e.baseFee,
      totalBonus: e.bonusAmount,
      total: e.total,
      deliveryCount: e.deliveryCount,
      confirmedCount: e.confirmed,
      paidOutCount: e.paidOut,
      totalShifts: Number(shiftMap.get(e.courierId)?.totalShifts ?? 0),
      totalDistanceKm: Number(shiftMap.get(e.courierId)?.totalDistance ?? 0),
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

function currentMonthParam(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function nextMonthStart(period: string): string {
  const [y, m] = period.split('-').map((n) => parseInt(n, 10));
  const d = new Date(Date.UTC(y, m, 1)); // m = periode 1-indexed; m+... js bulan 0-indexed -> bulan berikutnya
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}-01 00:00:00`;
}