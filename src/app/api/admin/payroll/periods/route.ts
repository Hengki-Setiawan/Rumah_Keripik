import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { payrollPeriods, payrollSlips, courierEarnings } from '@/lib/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { requireAdminRole, isForbiddenAdminPermissionError, isUnauthorizedAdminError } from '@/lib/admin-actor';
import { z } from 'zod';

const PeriodSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Format periode YYYY-MM'),
});

export async function GET() {
  try {
    await requireAdminRole('ledger:view');
    const periods = await db
      .select({
        id: payrollPeriods.id,
        periodStart: payrollPeriods.periodStart,
        periodEnd: payrollPeriods.periodEnd,
        status: payrollPeriods.status,
        lockedAt: payrollPeriods.lockedAt,
        paidAt: payrollPeriods.paidAt,
        createdAt: payrollPeriods.createdAt,
        slipCount: sql<number>`count(${payrollSlips.id})`,
        totalNet: sql<number>`coalesce(sum(${payrollSlips.totalNet}), 0)`,
      })
      .from(payrollPeriods)
      .leftJoin(payrollSlips, eq(payrollSlips.payrollPeriodId, payrollPeriods.id))
      .groupBy(payrollPeriods.id)
      .orderBy(desc(payrollPeriods.periodStart));

    return NextResponse.json({ ok: true, periods });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    console.error('[ADMIN_PAYROLL_PERIODS]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminRole('ledger:write');
    const body = PeriodSchema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid', details: body.error.flatten() }, { status: 400 });
    }

    const period = body.data.period;
    const [y, m] = period.split('-').map(Number);
    const periodStart = `${period}-01 00:00:00`;
    const endDate = new Date(Date.UTC(y, m, 1));
    const periodEnd = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, '0')}-01 00:00:00`;
    const periodId = `PRD-${period}`;

    const [existing] = await db.select({ id: payrollPeriods.id }).from(payrollPeriods).where(eq(payrollPeriods.id, periodId)).limit(1);
    if (existing) {
      return NextResponse.json({ ok: false, error: 'Periode sudah ada', periodId }, { status: 409 });
    }

    // Agregasi earnings per kurir untuk periode.
    const rows = await db
      .select({
        courierId: courierEarnings.courierId,
        baseFee: sql<number>`sum(${courierEarnings.baseFee})`,
        bonusAmount: sql<number>`sum(${courierEarnings.bonusAmount})`,
        count: sql<number>`count(*)`,
      })
      .from(courierEarnings)
      .where(
        and(
          gte(courierEarnings.createdAt, periodStart),
          lte(courierEarnings.createdAt, periodEnd)
        )
      )
      .groupBy(courierEarnings.courierId);

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: 'Tidak ada earnings untuk periode ini' }, { status: 400 });
    }

    await db.transaction(async (tx) => {
      await tx.insert(payrollPeriods).values({
        id: periodId,
        periodStart,
        periodEnd,
        status: 'open',
      });

      for (const r of rows) {
        const base = Number(r.baseFee ?? 0);
        const bonus = Number(r.bonusAmount ?? 0);
        await tx.insert(payrollSlips).values({
          id: `SLIP-${period}-${r.courierId}`,
          payrollPeriodId: periodId,
          courierId: r.courierId,
          totalDeliveries: Number(r.count ?? 0),
          totalBaseEarnings: base,
          totalBonus: bonus,
          totalPenalty: 0,
          totalNet: base + bonus,
        });
      }
    });

    return NextResponse.json({
      ok: true,
      data: { periodId, slipCount: rows.length, totalNet: rows.reduce((s, r) => s + Number(r.baseFee ?? 0) + Number(r.bonusAmount ?? 0), 0) },
    });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    console.error('[ADMIN_PAYROLL_GENERATE]', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal generate payroll' }, { status: 500 });
  }
}
