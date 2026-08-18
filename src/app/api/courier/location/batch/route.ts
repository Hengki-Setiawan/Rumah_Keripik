import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { couriers, courierLocations } from '@/lib/schema';
import { requireCourierAuth } from '@/lib/courier-auth';
import { CourierLocationBatchSchema } from '@/lib/courier-types';
import { eq } from 'drizzle-orm';

import { cacheCourierLocation } from '@/lib/redis';

export async function POST(request: Request) {
  try {
    const courier = await requireCourierAuth(request);
    if (!courier) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CourierLocationBatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Data lokasi tidak valid' }, { status: 400 });
    }

    const lastLocation = parsed.data.locations[parsed.data.locations.length - 1];
    const now = new Date().toISOString();

    // Cache to Upstash Redis
    void cacheCourierLocation({
      courierId: courier.id,
      lat: String(lastLocation.lat),
      lng: String(lastLocation.lng),
      recordedAt: new Date(lastLocation.timestamp).toISOString(),
      speed: lastLocation.speed ?? null,
      accuracy: lastLocation.accuracy ?? null,
    }).catch(() => undefined);

    await db
      .update(couriers)
      .set({
        last_lat: String(lastLocation.lat),
        last_lng: String(lastLocation.lng),
        last_location_at: now,
        updated_at: now,
      })
      .where(eq(couriers.id, courier.id));

    await db.insert(courierLocations).values(
      parsed.data.locations.map((loc) => ({
        courierId: courier.id,
        lat: String(loc.lat),
        lng: String(loc.lng),
        accuracy: loc.accuracy ?? null,
        speed: loc.speed ?? null,
        recordedAt: new Date(loc.timestamp).toISOString(),
        receivedAt: now,
      }))
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[COURIER_LOCATION_BATCH]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
