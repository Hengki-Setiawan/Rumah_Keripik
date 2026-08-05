import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courierShifts, shiftTemplates } from '@/lib/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { requireCourierAuth } from '@/lib/courier-auth';

export async function GET(req: Request) {
  try {
    const courier = await requireCourierAuth(req);
    if (!courier) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const days = Math.min(Number(url.searchParams.get('days')) || 14, 60);
    const today = new Date().toISOString().slice(0, 10);
    const horizon = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

    const rows = await db
      .select({
        id: courierShifts.id,
        shiftDate: courierShifts.shiftDate,
        plannedStart: courierShifts.plannedStart,
        plannedEnd: courierShifts.plannedEnd,
        status: courierShifts.status,
        isOnCall: courierShifts.isOnCall,
        shiftTemplateId: courierShifts.shiftTemplateId,
        shiftTemplateName: shiftTemplates.name,
      })
      .from(courierShifts)
      .leftJoin(shiftTemplates, eq(courierShifts.shiftTemplateId, shiftTemplates.id))
      .where(and(
        eq(courierShifts.courierId, courier.id),
        gte(courierShifts.shiftDate, today),
        sql`${courierShifts.shiftDate} <= ${horizon}`,
      ))
      .orderBy(courierShifts.shiftDate, courierShifts.plannedStart);

    return NextResponse.json({ ok: true, data: { shifts: rows } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal ambil jadwal' }, { status: 500 });
  }
}
