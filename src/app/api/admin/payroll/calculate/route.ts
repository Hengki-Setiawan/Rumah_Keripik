import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { couriers, shifts, deliveryAssignment, courierPerformanceDaily } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';

async function computePayroll(period: string) {
  const [year, month] = period.split('-').map(Number);
  const monthStart = `${period}-01`;
  const monthEnd = `${period}-${new Date(year, month, 0).getDate()}`;

  const allCouriers = await db.select().from(couriers).where(eq(couriers.is_active, 1));

  return await Promise.all(
    allCouriers.map(async (c) => {
      const [shiftAgg] = await db.select({
        totalHours: sql<number>`coalesce(sum(
          case when ${shifts.clockOutAt} is not null
            then (julianday(${shifts.clockOutAt}) - julianday(${shifts.clockInAt})) * 24
            else 0 end
        ), 0)`,
      }).from(shifts).where(and(
        eq(shifts.courierId, c.id),
        eq(shifts.status, 'ended'),
        sql`date(${shifts.clockInAt}) >= ${monthStart}`,
        sql`date(${shifts.clockInAt}) <= ${monthEnd}`,
      ));

      const [deliveryAgg] = await db.select({
        totalDeliveries: sql<number>`count(*)`,
        totalDistance: sql<number>`0`,
      }).from(deliveryAssignment).where(and(
        eq(deliveryAssignment.kurir_id, c.id),
        sql`date(${deliveryAssignment.created_at}) >= ${monthStart}`,
        sql`date(${deliveryAssignment.created_at}) <= ${monthEnd}`,
        eq(deliveryAssignment.status, 'Terkirim'),
      ));

      const totalHours = Number(shiftAgg?.totalHours || 0);
      const totalDeliveries = Number(deliveryAgg?.totalDeliveries || 0);
      const totalDistance = Number(deliveryAgg?.totalDistance || 0);
      const basePay = Math.round(totalDeliveries * 5000 + totalHours * 4000);
      const bonus = totalDeliveries >= 50 ? 100000 : totalDeliveries >= 30 ? 50000 : 0;
      const distanceBonus = totalDistance >= 200 ? 75000 : totalDistance >= 100 ? 30000 : 0;
      const penalty = 0;

      return {
        courierId: c.id,
        courierName: c.name,
        totalDeliveries,
        totalDistance: Math.round(totalDistance * 10) / 10,
        totalHours: Math.round(totalHours * 10) / 10,
        basePay,
        bonus: bonus + distanceBonus,
        penalty,
        totalPay: basePay + bonus + distanceBonus - penalty,
        paid: false,
        paidAt: null,
      };
    })
  );
}

function toCSV(entries: any[]) {
  const header = 'Nama Kurir,Pengiriman,Jam Kerja,Jarak (km),Gaji Pokok,Bonus,Denda,Total';
  const rows = entries.map(e =>
    `"${e.courierName}",${e.totalDeliveries},${e.totalHours},${e.totalDistance},${e.basePay},${e.bonus},${e.penalty},${e.totalPay}`
  );
  return [header, ...rows].join('\r\n');
}

export async function GET(req: Request) {
  try {
    await requireAdminRole('ledger:view');

    const url = new URL(req.url);
    const period = url.searchParams.get('period') || new Date().toISOString().slice(0, 7);
    const format = url.searchParams.get('format');

    const entries = await computePayroll(period);

    if (format === 'csv') {
      const csv = toCSV(entries);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="payroll-${period}.csv"`,
        },
      });
    }

    return NextResponse.json({ ok: true, data: entries });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: error.message || 'Gagal hitung payroll' }, { status: 500 });
  }
}
