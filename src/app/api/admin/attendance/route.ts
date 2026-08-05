import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courierAttendance, couriers, courierShifts, shiftTemplates } from '@/lib/schema';
import { eq, gte, lte, and, desc, sql } from 'drizzle-orm';
import { requireAdminRole, isForbiddenAdminPermissionError, isUnauthorizedAdminError } from '@/lib/admin-actor';

export async function GET(req: Request) {
  try {
    await requireAdminRole('courier:manage');
    const url = new URL(req.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const courierId = url.searchParams.get('courierId');
    const status = url.searchParams.get('status');

    const conditions = [];
    if (from) conditions.push(gte(courierAttendance.clockInAt, from));
    if (to) conditions.push(lte(courierAttendance.clockInAt, `${to} 23:59:59`));
    if (courierId) conditions.push(eq(courierAttendance.courierId, Number(courierId)));
    if (status) conditions.push(sql`${courierAttendance.status} = ${status}`);

    const rows = await db
      .select({
        id: courierAttendance.id,
        courierId: courierAttendance.courierId,
        courierName: couriers.name,
        courierPhone: couriers.phone,
        shiftId: courierAttendance.courierShiftId,
        shiftTemplateName: shiftTemplates.name,
        clockInAt: courierAttendance.clockInAt,
        clockInLat: courierAttendance.clockInLat,
        clockInLng: courierAttendance.clockInLng,
        clockInWithinGeofence: courierAttendance.clockInWithinGeofence,
        clockInSelfieUrl: courierAttendance.clockInSelfieUrl,
        clockOutAt: courierAttendance.clockOutAt,
        clockOutWithinGeofence: courierAttendance.clockOutWithinGeofence,
        totalWorkMinutes: courierAttendance.totalWorkMinutes,
        status: courierAttendance.status,
        notes: courierAttendance.notes,
      })
      .from(courierAttendance)
      .leftJoin(couriers, eq(courierAttendance.courierId, couriers.id))
      .leftJoin(courierShifts, eq(courierAttendance.courierShiftId, courierShifts.id))
      .leftJoin(shiftTemplates, eq(courierShifts.shiftTemplateId, shiftTemplates.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(courierAttendance.clockInAt))
      .limit(200);

    const summary = await db
      .select({
        totalOpen: sql<number>`sum(case when ${courierAttendance.status} = 'open' then 1 else 0 end)`,
        totalClosed: sql<number>`sum(case when ${courierAttendance.status} = 'closed' then 1 else 0 end)`,
        totalFlagged: sql<number>`sum(case when ${courierAttendance.status} like 'flagged%' then 1 else 0 end)`,
      })
      .from(courierAttendance)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return NextResponse.json({ ok: true, attendance: rows, summary: summary[0] });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    console.error('[ADMIN_ATTENDANCE]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
