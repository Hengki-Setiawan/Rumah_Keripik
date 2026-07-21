import { NextResponse } from 'next/server';
import { CourierLoginSchema } from '@/lib/courier-types';
import { verifyCourierLogin, createCourierSession } from '@/lib/courier-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CourierLoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Format phone atau PIN salah' }, { status: 400 });
    }

    const { phone, pin } = parsed.data;
    const courier = await verifyCourierLogin(phone, pin);
    if (!courier) {
      return NextResponse.json({ ok: false, error: 'Phone atau PIN salah' }, { status: 401 });
    }

    const token = await createCourierSession(courier.id);

    return NextResponse.json({
      ok: true,
      token,
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
    console.error('[COURIER_LOGIN]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
