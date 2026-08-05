import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courierShifts } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdminRole, isForbiddenAdminPermissionError, isUnauthorizedAdminError } from '@/lib/admin-actor';

const UpdateShiftSchema = z.object({
  status: z.enum(['scheduled', 'confirmed', 'swapped', 'cancelled', 'completed', 'no_show']).optional(),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
  isOnCall: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminRole('courier:manage');
    const { id } = await params;
    const shiftId = Number(id);
    if (!Number.isInteger(shiftId)) return NextResponse.json({ ok: false, error: 'ID tidak valid' }, { status: 400 });

    const body = UpdateShiftSchema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ ok: false, error: 'Data tidak valid' }, { status: 400 });

    const [existing] = await db.select().from(courierShifts).where(eq(courierShifts.id, shiftId)).limit(1);
    if (!existing) return NextResponse.json({ ok: false, error: 'Jadwal shift tidak ditemukan' }, { status: 404 });

    await db.update(courierShifts).set({
      status: body.data.status,
      plannedStart: body.data.plannedStart,
      plannedEnd: body.data.plannedEnd,
      isOnCall: body.data.isOnCall !== undefined ? (body.data.isOnCall ? 1 : 0) : undefined,
      updatedAt: new Date().toISOString(),
    }).where(eq(courierShifts.id, shiftId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal update shift' }, { status: 500 });
  }
}
