import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { couriers } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';
import { CourierRegisterSchema } from '@/lib/courier-types';
import { hashPin } from '@/lib/courier-auth';

export async function GET() {
  try {
    await requireAdminRole('order:update');

    const result = await db
      .select()
      .from(couriers)
      .orderBy(desc(couriers.created_at));

    return NextResponse.json({
      ok: true,
      couriers: result.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        vehicle: c.vehicle,
        plat_no: c.plat_no,
        is_active: c.is_active === 1,
        last_lat: c.last_lat,
        last_lng: c.last_lng,
        last_location_at: c.last_location_at,
        created_at: c.created_at,
      })),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[ADMIN_COURIERS_LIST]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminRole('order:update');

    const body = await request.json();
    const parsed = CourierRegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid', details: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(couriers)
      .where(eq(couriers.phone, parsed.data.phone))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ ok: false, error: 'Nomor telepon sudah terdaftar' }, { status: 409 });
    }

    const [newCourier] = await db
      .insert(couriers)
      .values({
        name: parsed.data.name,
        phone: parsed.data.phone,
        pin_hash: await hashPin(parsed.data.pin),
        vehicle: parsed.data.vehicle,
        plat_no: parsed.data.plat_no,
      })
      .returning();

    return NextResponse.json({
      ok: true,
      courier: {
        id: newCourier.id,
        name: newCourier.name,
        phone: newCourier.phone,
        vehicle: newCourier.vehicle,
        plat_no: newCourier.plat_no,
        is_active: newCourier.is_active === 1,
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[ADMIN_COURIERS_CREATE]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
