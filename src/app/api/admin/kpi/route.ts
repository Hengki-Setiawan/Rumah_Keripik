import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courierKpiDaily, deliveryAssignment, courierEarnings } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdminRole, isForbiddenAdminPermissionError, isUnauthorizedAdminError } from '@/lib/admin-actor';

const ComputeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD').optional(),
  courierId: z.number().int().positive().optional(),
});

export async function GET() {
  try {
    await requireAdminRole('courier:manage');
    const rows = await db
      .select()
      .from(courierKpiDaily)
      .orderBy(sql`${courierKpiDaily.kpiDate} desc, ${courierKpiDaily.totalEarnings} desc`)
      .limit(200);
    return NextResponse.json({ ok: true, kpi: rows });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    console.error('[ADMIN_KPI]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminRole('courier:manage');
    const body = ComputeSchema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid', details: body.error.flatten() }, { status: 400 });
    }

    const date = body.data.date ?? new Date().toISOString().slice(0, 10);

    // Ambil semua kurir yang punya aktivitas di tanggal tsb.
    const courierIds = await db
      .select({ id: deliveryAssignment.kurir_id })
      .from(deliveryAssignment)
      .where(sql`date(${deliveryAssignment.created_at}) = ${date}`)
      .groupBy(deliveryAssignment.kurir_id);

    const ids = courierIds
      .map((r) => r.id)
      .filter((id): id is number => id != null);

    if (ids.length === 0) {
      return NextResponse.json({ ok: true, data: { date, computed: 0, message: 'Tidak ada aktivitas' } });
    }

    let computed = 0;
    for (const courierId of ids) {
      const agg = await db
        .select({
          totalAssigned: sql<number>`count(*)`,
          totalDelivered: sql<number>`sum(case when ${deliveryAssignment.status} = 'Terkirim' then 1 else 0 end)`,
          totalFailed: sql<number>`sum(case when ${deliveryAssignment.status} = 'Gagal' then 1 else 0 end)`,
        })
        .from(deliveryAssignment)
        .where(and(
          eq(deliveryAssignment.kurir_id, courierId),
          sql`date(${deliveryAssignment.created_at}) = ${date}`,
        ));

      const earningsAgg = await db
        .select({
          total: sql<number>`coalesce(sum(${courierEarnings.baseFee} + ${courierEarnings.bonusAmount}), 0)`,
        })
        .from(courierEarnings)
        .where(and(
          eq(courierEarnings.courierId, courierId),
          sql`date(${courierEarnings.createdAt}) = ${date}`,
        ));

      const a = agg[0];
      const delivered = Number(a?.totalDelivered ?? 0);
      const failed = Number(a?.totalFailed ?? 0);
      const assigned = Number(a?.totalAssigned ?? 0);

      await db.insert(courierKpiDaily).values({
        courierId,
        kpiDate: date,
        totalAssigned: assigned,
        totalDelivered: delivered,
        totalFailed: failed,
        onTimeRate: assigned > 0 ? (delivered / assigned) * 100 : null,
        totalEarnings: Number(earningsAgg[0]?.total ?? 0),
      }).onConflictDoUpdate({
        target: [courierKpiDaily.courierId, courierKpiDaily.kpiDate],
        set: {
          totalAssigned: assigned,
          totalDelivered: delivered,
          totalFailed: failed,
          onTimeRate: assigned > 0 ? (delivered / assigned) * 100 : null,
          totalEarnings: Number(earningsAgg[0]?.total ?? 0),
          computedAt: new Date().toISOString(),
        },
      });
      computed++;
    }

    return NextResponse.json({ ok: true, data: { date, computed } });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    console.error('[ADMIN_KPI_COMPUTE]', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal hitung KPI' }, { status: 500 });
  }
}
