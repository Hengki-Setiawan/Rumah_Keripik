import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courierEarnings } from '@/lib/schema';
import { eq, desc, and } from 'drizzle-orm';
import { requireAdminRole, isUnauthorizedAdminError } from '@/lib/admin-actor';

export async function GET(req: Request) {
  try {
    await requireAdminRole('ledger:view');
    const { searchParams } = new URL(req.url);
    const courierId = searchParams.get('courierId');
    const status = searchParams.get('status');

    const filters = [];
    if (courierId) filters.push(eq(courierEarnings.courierId, parseInt(courierId)));
    if (status) filters.push(eq(courierEarnings.status, status as 'pending' | 'confirmed' | 'paid_out'));

    const earnings = await db
      .select()
      .from(courierEarnings)
      .where(filters.length ? and(...filters) : undefined)
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

export async function PATCH(req: Request) {
  try {
    await requireAdminRole('ledger:write');
    const { earningId, status, note } = await req.json();
    if (!earningId || !status) {
      return NextResponse.json({ ok: false, error: 'earningId dan status wajib' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { status };
    if (status === 'paid_out') updateData.paid_out_at = new Date().toISOString();
    if (note) updateData.note = note;

    await db.update(courierEarnings).set(updateData).where(eq(courierEarnings.id, earningId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) {
      return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal' }, { status: 500 });
  }
}
