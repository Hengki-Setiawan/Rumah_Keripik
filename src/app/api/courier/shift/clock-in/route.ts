import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shifts } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { requireCourierAuth } from '@/lib/courier-auth';
import { z } from 'zod';
import { calculateDistance } from '@/lib/location-parser';

const ClockInSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

// Radius maksimum clock-in dari gudang (km). Bisa di-override via env.
// Di bawah default: 20 km (jangan terlalu ketat agar kurir yang clock-in
// dari rumah masih bisa; 0/vacuous = nonaktifkan geofence).
const GUDANG_LAT = -5.134;
const GUDANG_LNG = 119.4135;

function geofenceRadiusKm(): number {
  const raw = process.env.COURIER_GEOFENCE_RADIUS_KM;
  if (!raw) return 20;
  return Math.max(0, Number(raw) || 0);
}

export async function POST(req: Request) {
  try {
    const courier = await requireCourierAuth(req);
    if (!courier) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = ClockInSchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid', details: body.error.flatten() }, { status: 400 });
    }

    // Geofence: hanya diperiksa saat koordinat diberikan & radius > 0.
    const { lat, lng } = body.data;
    if (lat != null && lng != null) {
      const radiusKm = geofenceRadiusKm();
      if (radiusKm > 0) {
        const distKm = calculateDistance(GUDANG_LAT, GUDANG_LNG, lat, lng);
        if (distKm > radiusKm) {
          return NextResponse.json(
            { ok: false, error: `LOKASI_DILUAR_BATAS`, message: `Lokasi berjarak ${distKm.toFixed(1)} km dari gudang (maks ${radiusKm} km).` },
            { status: 403 },
          );
        }
      }
    }

    const existingActive = await db.select()
      .from(shifts)
      .where(and(eq(shifts.courierId, courier.id), eq(shifts.status, 'active')))
      .limit(1);

    if (existingActive.length > 0) {
      return NextResponse.json({ ok: false, error: 'SHIFT_ALREADY_ACTIVE', shiftId: existingActive[0].id }, { status: 409 });
    }

    const result = await db.insert(shifts).values({
      courierId: courier.id,
      clockInLat: body.data.lat != null ? String(body.data.lat) : null,
      clockInLng: body.data.lng != null ? String(body.data.lng) : null,
      totalDistanceKm: 0,
      status: 'active',
    }).returning({ id: shifts.id, clockInAt: shifts.clockInAt });

    return NextResponse.json({ ok: true, data: { shiftId: result[0]?.id, clockInAt: result[0]?.clockInAt } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal clock-in' }, { status: 500 });
  }
}
