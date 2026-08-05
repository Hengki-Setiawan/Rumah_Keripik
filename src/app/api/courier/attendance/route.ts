import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courierAttendance } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { requireCourierAuth } from '@/lib/courier-auth';

export async function GET(req: Request) {
  try {
    const courier = await requireCourierAuth(req);
    if (!courier) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get('limit')) || 30, 100);

    const rows = await db
      .select({
        id: courierAttendance.id,
        clockInAt: courierAttendance.clockInAt,
        clockInWithinGeofence: courierAttendance.clockInWithinGeofence,
        clockOutAt: courierAttendance.clockOutAt,
        clockOutWithinGeofence: courierAttendance.clockOutWithinGeofence,
        totalWorkMinutes: courierAttendance.totalWorkMinutes,
        status: courierAttendance.status,
      })
      .from(courierAttendance)
      .where(eq(courierAttendance.courierId, courier.id))
      .orderBy(desc(courierAttendance.clockInAt))
      .limit(limit);

    return NextResponse.json({ ok: true, data: { attendance: rows } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal ambil absensi' }, { status: 500 });
  }
}
