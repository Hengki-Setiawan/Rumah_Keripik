import { NextResponse } from 'next/server';
import { requireCourierAuth } from '@/lib/courier-auth';

export async function GET(request: Request) {
  try {
    const courier = await requireCourierAuth(request);
    if (!courier) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      courier: {
        id: courier.id,
        name: courier.name,
        phone: courier.phone,
        vehicle: courier.vehicle,
        plat_no: courier.plat_no,
        is_active: courier.is_active === 1,
      },
    });
  } catch (error) {
    console.error('[COURIER_ME]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
