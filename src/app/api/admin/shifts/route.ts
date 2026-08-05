import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courierShifts, shiftTemplates, couriers } from '@/lib/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdminRole, isForbiddenAdminPermissionError, isUnauthorizedAdminError } from '@/lib/admin-actor';

const CreateShiftSchema = z.object({
  courierId: z.number().int().positive(),
  shiftTemplateId: z.number().int().positive().optional(),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD'),
  plannedStart: z.string(),
  plannedEnd: z.string(),
  isOnCall: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    await requireAdminRole('courier:manage');
    const url = new URL(req.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const courierId = url.searchParams.get('courierId');

    const conditions = [];
    if (from) conditions.push(gte(courierShifts.shiftDate, from));
    if (to) conditions.push(sql`${courierShifts.shiftDate} <= ${to}`);
    if (courierId) conditions.push(eq(courierShifts.courierId, Number(courierId)));

    const rows = await db
      .select({
        id: courierShifts.id,
        courierId: courierShifts.courierId,
        courierName: couriers.name,
        courierPhone: couriers.phone,
        shiftTemplateId: courierShifts.shiftTemplateId,
        shiftTemplateName: shiftTemplates.name,
        shiftDate: courierShifts.shiftDate,
        plannedStart: courierShifts.plannedStart,
        plannedEnd: courierShifts.plannedEnd,
        status: courierShifts.status,
        swapRequestedToCourierId: courierShifts.swapRequestedToCourierId,
        isOnCall: courierShifts.isOnCall,
        createdAt: courierShifts.createdAt,
      })
      .from(courierShifts)
      .leftJoin(couriers, eq(courierShifts.courierId, couriers.id))
      .leftJoin(shiftTemplates, eq(courierShifts.shiftTemplateId, shiftTemplates.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(courierShifts.shiftDate), courierShifts.plannedStart);

    return NextResponse.json({ ok: true, shifts: rows });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    console.error('[ADMIN_SHIFTS]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { actor } = await requireAdminRole('courier:manage');
    const body = CreateShiftSchema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid', details: body.error.flatten() }, { status: 400 });
    }

    const [courier] = await db.select({ id: couriers.id }).from(couriers).where(eq(couriers.id, body.data.courierId)).limit(1);
    if (!courier) return NextResponse.json({ ok: false, error: 'Kurir tidak ditemukan' }, { status: 404 });

    const [shift] = await db.insert(courierShifts).values({
      courierId: body.data.courierId,
      shiftTemplateId: body.data.shiftTemplateId ?? null,
      shiftDate: body.data.shiftDate,
      plannedStart: body.data.plannedStart,
      plannedEnd: body.data.plannedEnd,
      status: 'scheduled',
      isOnCall: body.data.isOnCall ? 1 : 0,
      createdBy: actor,
    }).returning({ id: courierShifts.id, shiftDate: courierShifts.shiftDate });

    return NextResponse.json({ ok: true, data: { id: shift?.id, shiftDate: shift?.shiftDate } });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal buat jadwal shift' }, { status: 500 });
  }
}
