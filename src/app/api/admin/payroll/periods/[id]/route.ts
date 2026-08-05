import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { payrollPeriods } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdminRole, isForbiddenAdminPermissionError, isUnauthorizedAdminError } from '@/lib/admin-actor';

const UpdateSchema = z.object({
  status: z.enum(['open', 'locked', 'paid']),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminRole('ledger:write');
    const { id } = await params;
    const body = UpdateSchema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ ok: false, error: 'Data tidak valid' }, { status: 400 });

    const [existing] = await db.select({ id: payrollPeriods.id }).from(payrollPeriods).where(eq(payrollPeriods.id, id)).limit(1);
    if (!existing) return NextResponse.json({ ok: false, error: 'Periode tidak ditemukan' }, { status: 404 });

    const now = new Date().toISOString();
    await db.update(payrollPeriods).set({
      status: body.data.status,
      lockedAt: body.data.status === 'locked' ? now : undefined,
      paidAt: body.data.status === 'paid' ? now : undefined,
    }).where(eq(payrollPeriods.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal update periode' }, { status: 500 });
  }
}
