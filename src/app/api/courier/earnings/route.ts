import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courierEarnings } from '@/lib/schema';
import { eq, desc, and, sum } from 'drizzle-orm';
import { requireCourierAuth } from '@/lib/courier-auth';

export async function GET(req: Request) {
  try {
    const courier = await requireCourierAuth(req);
    if (!courier) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'daily';

    const now = new Date();
    let startDate: string;
    if (period === 'daily') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    } else if (period === 'weekly') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      startDate = weekAgo.toISOString();
    } else {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      startDate = monthAgo.toISOString();
    }

    const earnings = await db
      .select()
      .from(courierEarnings)
      .where(and(eq(courierEarnings.courierId, courier.id), eq(courierEarnings.status, 'confirmed')))
      .orderBy(desc(courierEarnings.createdAt))
      .limit(50);

    const totalConfirmed = earnings.reduce((sum, e) => sum + e.baseFee + e.bonusAmount, 0);
    const pendingTotal = await db
      .select({ total: sum(courierEarnings.baseFee) })
      .from(courierEarnings)
      .where(and(eq(courierEarnings.courierId, courier.id), eq(courierEarnings.status, 'pending')));

    return NextResponse.json({
      ok: true,
      earnings,
      summary: {
        totalConfirmed,
        pendingTotal: pendingTotal[0]?.total || 0,
        deliveryCount: earnings.length,
        period,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal memuat pendapatan' }, { status: 500 });
  }
}
