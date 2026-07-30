import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { couriers, shifts } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';

export async function GET() {
  try {
    await requireAdminRole('courier:manage');

    const activeCouriers = await db.select({
      id: couriers.id,
      name: couriers.name,
      phone: couriers.phone,
      photoUrl: couriers.photo_url,
      vehicle: couriers.vehicle,
      platNo: couriers.plat_no,
      lastLat: couriers.last_lat,
      lastLng: couriers.last_lng,
      lastLocationAt: couriers.last_location_at,
    })
      .from(couriers)
      .where(and(
        eq(couriers.is_active, 1),
        sql`${couriers.last_lat} IS NOT NULL`,
        sql`${couriers.last_lng} IS NOT NULL`,
      ));

    const courierIds = activeCouriers.map(c => c.id);
    const activeShifts = courierIds.length > 0
      ? await db.select({ courierId: shifts.courierId, status: shifts.status })
          .from(shifts)
          .where(and(
            sql`${shifts.courierId} IN (${courierIds.join(',')})`,
            eq(shifts.status, 'active'),
          ))
      : [];

    const shiftMap = new Map(activeShifts.map(s => [s.courierId, s.status]));

    const result = activeCouriers.map(c => ({
      ...c,
      isOnShift: shiftMap.has(c.id),
    }));

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal memuat lokasi' }, { status: 500 });
  }
}
