import { NextResponse } from 'next/server';
import { requireCourierAuth } from '@/lib/courier-auth';
import { bindDeviceToCourier, unbindDevice, verifyDeviceBinding } from '@/services/courier-security';

export async function POST(request: Request) {
  try {
    const courier = await requireCourierAuth(request);
    if (!courier) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, deviceId } = body;

    if (action === 'bind') {
      if (!deviceId) {
        return NextResponse.json({ ok: false, error: 'deviceId diperlukan' }, { status: 400 });
      }
      const result = await bindDeviceToCourier(courier.id, deviceId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'unbind') {
      const result = await unbindDevice(courier.id);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'verify') {
      if (!deviceId) {
        return NextResponse.json({ ok: false, error: 'deviceId diperlukan' }, { status: 400 });
      }
      const bound = await verifyDeviceBinding(courier.id, deviceId);
      return NextResponse.json({ ok: true, bound });
    }

    return NextResponse.json({ ok: false, error: 'Aksi tidak dikenal' }, { status: 400 });
  } catch (error) {
    console.error('[COURIER_DEVICE]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}