import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { trackingEvents, couriers } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { requireCourierAuth } from '@/lib/courier-auth';
import { z } from 'zod';

const LocationPushSchema = z.object({
  orderId: z.string(),
  lat: z.string(),
  lng: z.string(),
  etaMinutes: z.number().optional(),
});

export async function POST(req: Request) {
  try {
    const courier = await requireCourierAuth(req);
    if (!courier) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = LocationPushSchema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid', details: body.error.flatten() }, { status: 400 });
    }

    const { orderId, lat, lng, etaMinutes } = body.data;

    await db.insert(trackingEvents).values({
      orderId,
      eventType: 'courier_location',
      lat,
      lng,
      etaMinutes: etaMinutes || null,
      courierId: courier.id,
    });

    await db.update(couriers).set({
      last_lat: lat,
      last_lng: lng,
      last_location_at: new Date().toISOString(),
    }).where(eq(couriers.id, courier.id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal' }, { status: 500 });
  }
}
