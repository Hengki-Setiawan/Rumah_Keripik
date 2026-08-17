import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courierEarnings } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { requireAdminRole, isUnauthorizedAdminError } from '@/lib/admin-actor';

export async function GET(req: Request) {
  try {
    await requireAdminRole('ledger:view');
    const { searchParams } = new URL(req.url);
    const courierId = searchParams.get('courierId');

    const earnings = await db
      .select()
      .from(courierEarnings)
      .where(courierId ? eq(courierEarnings.courierId, parseInt(courierId)) : undefined)
      .orderBy(desc(courierEarnings.createdAt))
      .limit(100);

    return NextResponse.json({ ok: true, earnings });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) {
      return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal' }, { status: 500 });
  }
}
