import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { couriers, courierLocations } from '@/lib/schema';
import { requireCourierAuth } from '@/lib/courier-auth';
import { CourierLocationBatchSchema } from '@/lib/courier-types';
import { checkCourierRateLimit } from '@/lib/rate-limit-courier';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const courier = await requireCourierAuth(request);
    if (!courier) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    const rl = await checkCourierRateLimit('locationBatch', request, courier.id);
    if (!rl.ok) {
      return NextResponse.json({ ok: false, error: 'Terlalu banyak update lokasi' }, { status: 429, headers: { 'X-RateLimit-Reset': String(rl.resetAt) } });
    }

    const body = await request.json();
    const parsed = CourierLocationBatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Data lokasi tidak valid' }, { status: 400 });
    }

    const locations = parsed.data.locations;
    const lastLocation = locations[locations.length - 1];
    const now = new Date().toISOString();

    await db.insert(courierLocations).values(
      locations.map((loc) => ({
        courierId: courier.id,
        lat: String(loc.lat),
        lng: String(loc.lng),
        accuracy: loc.accuracy ?? null,
        speed: loc.speed ?? null,
        heading: null,
        batteryLevel: null,
        recordedAt: new Date(loc.timestamp).toISOString().replace('T', ' ').slice(0, 19) || now,
      }))
    );

    await db
      .update(couriers)
      .set({
        last_lat: String(lastLocation.lat),
        last_lng: String(lastLocation.lng),
        last_location_at: now,
        updated_at: now,
      })
      .where(eq(couriers.id, courier.id));

    return NextResponse.json({ ok: true, data: { accepted: locations.length } });
  } catch (error) {
    console.error('[COURIER_LOCATION_BATCH]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
