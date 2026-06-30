import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transaksi } from '@/lib/schema';
import { eq, sql, gte, and } from 'drizzle-orm';

export async function GET() {
  try {
    const days = 7;
    const data: { date: string; revenue: number; orders: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString();

      const [result] = await db
        .select({
          revenue: sql<number>`COALESCE(SUM(${transaksi.total_bayar}), 0)`,
          orders: sql<number>`COUNT(*)`,
        })
        .from(transaksi)
        .where(
          and(
            eq(transaksi.status_pembayaran, 'Lunas'),
            gte(transaksi.waktu_simpan, dayStart),
            sql`${transaksi.waktu_simpan} < ${dayEnd}`,
          ),
        );

      data.push({
        date: dayStart.slice(0, 10),
        revenue: result.revenue,
        orders: result.orders,
      });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[Analytics/Revenue/Chart]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
