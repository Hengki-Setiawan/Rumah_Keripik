import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { couriers, deliveryAssignment } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';
import crypto from 'crypto';

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminRole('order:update');

    const { id } = await params;
    const courierId = parseInt(id, 10);
    if (isNaN(courierId)) {
      return NextResponse.json({ ok: false, error: 'ID tidak valid' }, { status: 400 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};
    if (body.name) updateData.name = body.name;
    if (body.phone) updateData.phone = body.phone;
    if (body.pin) updateData.pin_hash = hashPin(body.pin);
    if (body.vehicle) updateData.vehicle = body.vehicle;
    if (body.plat_no !== undefined) updateData.plat_no = body.plat_no;
    if (body.is_active !== undefined) updateData.is_active = body.is_active ? 1 : 0;
    updateData.updated_at = new Date().toISOString();

    const [updated] = await db
      .update(couriers)
      .set(updateData)
      .where(eq(couriers.id, courierId))
      .returning();

    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Kurir tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      courier: {
        id: updated.id,
        name: updated.name,
        phone: updated.phone,
        vehicle: updated.vehicle,
        plat_no: updated.plat_no,
        is_active: updated.is_active === 1,
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[ADMIN_COURIER_UPDATE]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminRole('order:update');

    const { id } = await params;
    const courierId = parseInt(id, 10);
    if (isNaN(courierId)) {
      return NextResponse.json({ ok: false, error: 'ID tidak valid' }, { status: 400 });
    }

    await db
      .update(couriers)
      .set({ is_active: 0, updated_at: new Date().toISOString() })
      .where(eq(couriers.id, courierId));

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[ADMIN_COURIER_DELETE]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
