import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sosEvents } from '@/lib/schema';
import { z } from 'zod';
import { verifyCourierAuth } from '@/lib/courier/auth';
import { couriers } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';

const IncidentSchema = z.object({
  type: z.enum(['kecelakaan', 'kendaraan_mogok', 'cuaca_ekstrem', 'keamanan', 'kesehatan', 'lainnya']),
  severity: z.enum(['low', 'medium', 'high', 'emergency']).default('medium'),
  description: z.string().optional(),
  lat: z.string().optional(),
  lng: z.string().optional(),
  deliveryId: z.number().optional(),
  photoUrl: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const auth = await verifyCourierAuth(req);
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 50);

    const incidents = await db
      .select()
      .from(sosEvents)
      .where(eq(sosEvents.courierId, auth.courierId))
      .orderBy(desc(sosEvents.createdAt))
      .limit(limit);

    return NextResponse.json({
      ok: true,
      data: {
        incidents: incidents.map((i) => ({
          id: i.id,
          type: i.type || 'lainnya',
          severity: i.severity || 'medium',
          status: i.status,
          created_at: i.createdAt,
          description: i.message,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal ambil insiden' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await verifyCourierAuth(req);
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = IncidentSchema.parse(await req.json());
    const [courier] = await db.select().from(couriers).where(eq(couriers.id, auth.courierId)).limit(1);

    await db.insert(sosEvents).values({
      courierId: auth.courierId,
      courierName: courier?.name || null,
      courierPhone: courier?.phone || null,
      type: body.type,
      severity: body.severity,
      lat: body.lat || '0',
      lng: body.lng || '0',
      message: body.description || null,
      status: 'active',
    });

    return NextResponse.json({ ok: true, data: { message: 'Incident reported' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal lapor insiden' }, { status: 500 });
  }
}
