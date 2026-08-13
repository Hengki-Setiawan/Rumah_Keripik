import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shifts, deliveryAssignment, courierAttendance, courierLocations } from '@/lib/schema';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { requireCourierAuth } from '@/lib/courier-auth';
import { z } from 'zod';
import { checkAttendanceGeofence } from '@/lib/courier/geofence';
import { sumTrackedDistanceKm } from '@/lib/courier-distance';

const ClockOutSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export async function POST(req: Request) {
  try {
    const courier = await requireCourierAuth(req);
    if (!courier) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = ClockOutSchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid', details: body.error.flatten() }, { status: 400 });
    }

    const [activeShift] = await db.select()
      .from(shifts)
      .where(and(eq(shifts.courierId, courier.id), eq(shifts.status, 'active')))
      .limit(1);

    if (!activeShift) {
      return NextResponse.json({ ok: false, error: 'SHIFT_NOT_ACTIVE' }, { status: 400 });
    }

    const deliveries = await db.select({ count: sql<number>`count(*)` })
      .from(deliveryAssignment)
      .where(and(
        eq(deliveryAssignment.kurir_id, courier.id),
        sql`date(${deliveryAssignment.created_at}) = date('now')`,
        eq(deliveryAssignment.status, 'Terkirim'),
      ));

    const now = new Date().toISOString();

    // Geofence clock-out opsional: kalau koordinat diberikan, tandai dalam batas.
    let geofence = null;
    const { lat, lng } = body.data;
    if (lat != null && lng != null) {
      geofence = await checkAttendanceGeofence(lat, lng);
    }

    const clockInTime = activeShift.clockInAt ? new Date(activeShift.clockInAt).getTime() : null;
    const totalWorkMinutes = clockInTime ? Math.round((new Date(now).getTime() - clockInTime) / 60000) : null;

    // Jarak aktual shift = lintasan titik GPS kurir sejak clock-in sampai clock-out.
    const shiftPoints = activeShift.clockInAt
      ? await db
          .select({ lat: courierLocations.lat, lng: courierLocations.lng })
          .from(courierLocations)
          .where(
            and(
              eq(courierLocations.courierId, courier.id),
              gte(courierLocations.recordedAt, activeShift.clockInAt),
              lte(courierLocations.recordedAt, now)
            )
          )
          .orderBy(courierLocations.recordedAt)
      : [];
    const totalDistanceKm = sumTrackedDistanceKm(
      shiftPoints.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
    );

    await db.transaction(async (tx) => {
      await tx.update(shifts).set({
        clockOutAt: now,
        clockOutLat: lat != null ? String(lat) : null,
        clockOutLng: lng != null ? String(lng) : null,
        totalDeliveries: Number(deliveries[0]?.count || 0),
        totalDistanceKm,
        status: 'ended',
      }).where(eq(shifts.id, activeShift.id));

      // Tutup attendance record paling baru untuk kurir ini hari ini.
      const attendanceRows = await tx.select({ id: courierAttendance.id })
        .from(courierAttendance)
        .where(and(
          eq(courierAttendance.courierId, courier.id),
          sql`date(${courierAttendance.clockInAt}) = date('now')`,
        ))
        .orderBy(desc(courierAttendance.id))
        .limit(1);

      if (attendanceRows.length > 0) {
        await tx.update(courierAttendance).set({
          clockOutAt: now,
          clockOutLat: lat != null ? String(lat) : null,
          clockOutLng: lng != null ? String(lng) : null,
          clockOutWithinGeofence: geofence ? (geofence.inside ? 1 : 0) : null,
          totalWorkMinutes,
          status: geofence && !geofence.inside ? 'flagged_early_leave' : 'closed',
        }).where(eq(courierAttendance.id, attendanceRows[0].id));
      }
    });

    return NextResponse.json({
      ok: true,
      data: {
        shiftId: activeShift.id,
        clockInAt: activeShift.clockInAt,
        clockOutAt: now,
        totalDeliveries: Number(deliveries[0]?.count || 0),
        totalWorkMinutes,
        totalDistanceKm,
        geofence: geofence
          ? { inside: geofence.inside, distanceMeters: geofence.distanceMeters, warehouseName: geofence.warehouseName, zoneName: geofence.zoneName }
          : null,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal clock-out' }, { status: 500 });
  }
}
