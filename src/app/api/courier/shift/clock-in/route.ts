import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shifts, courierAttendance } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { requireCourierAuth } from '@/lib/courier-auth';
import { z } from 'zod';
import { checkAttendanceGeofence } from '@/lib/courier/geofence';

const ClockInSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  selfieUrl: z.string().url().optional().or(z.literal('')),
  shiftId: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  try {
    const courier = await requireCourierAuth(req);
    if (!courier) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = ClockInSchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid', details: body.error.flatten() }, { status: 400 });
    }

    const existingActive = await db.select()
      .from(shifts)
      .where(and(eq(shifts.courierId, courier.id), eq(shifts.status, 'active')))
      .limit(1);

    if (existingActive.length > 0) {
      return NextResponse.json({ ok: false, error: 'SHIFT_ALREADY_ACTIVE', shiftId: existingActive[0].id }, { status: 409 });
    }

    // Geofence absensi berbasis zona (attendance_radius) dari tabel geofence_zones.
    let geofence = null;
    let flaggedNoGeofence = false;
    const { lat, lng } = body.data;

    if (lat != null && lng != null) {
      geofence = await checkAttendanceGeofence(lat, lng);
      if (!geofence.inside) {
        return NextResponse.json(
          {
            ok: false,
            error: 'LOKASI_DILUAR_BATAS',
            message: `Lokasi berjarak ${(geofence.distanceMeters / 1000).toFixed(1)} km dari ${geofence.warehouseName ?? 'gudang'} (maks ${((geofence.radiusMeters ?? 0) / 1000).toFixed(1)} km).`,
          },
          { status: 403 },
        );
      }
      if (geofence.radiusMeters == null) flaggedNoGeofence = true;
    }

    const result = await db.transaction(async (tx) => {
      const shift = await tx.insert(shifts).values({
        courierId: courier.id,
        clockInLat: lat != null ? String(lat) : null,
        clockInLng: lng != null ? String(lng) : null,
        totalDistanceKm: 0,
        status: 'active',
      }).returning({ id: shifts.id, clockInAt: shifts.clockInAt });

      await tx.insert(courierAttendance).values({
        courierId: courier.id,
        courierShiftId: body.data.shiftId ?? null,
        clockInAt: shift[0]?.clockInAt ?? null,
        clockInLat: lat != null ? String(lat) : null,
        clockInLng: lng != null ? String(lng) : null,
        clockInWithinGeofence: lat != null && lng != null && geofence != null ? (geofence.inside ? 1 : 0) : null,
        clockInSelfieUrl: body.data.selfieUrl || null,
        status: flaggedNoGeofence ? 'flagged_no_geofence' : 'open',
      });

      return shift;
    });

    return NextResponse.json({
      ok: true,
      data: {
        shiftId: result[0]?.id,
        clockInAt: result[0]?.clockInAt,
        geofence: geofence
          ? { inside: geofence.inside, distanceMeters: geofence.distanceMeters, warehouseName: geofence.warehouseName, zoneName: geofence.zoneName }
          : null,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal clock-in' }, { status: 500 });
  }
}
