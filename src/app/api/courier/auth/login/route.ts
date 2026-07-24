import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { couriers, courierSessions } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { signAccessToken, signRefreshToken, generateRefreshTokenId } from '@/lib/auth-jwt';

const LoginSchema = z.object({
  phone: z.string().min(10).max(20),
  pin: z.string().length(4).regex(/^\d+$/),
  deviceId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = LoginSchema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid', details: body.error.flatten() }, { status: 400 });
    }

    const { phone, pin, deviceId } = body.data;

    const [courier] = await db
      .select()
      .from(couriers)
      .where(and(eq(couriers.phone, phone), eq(couriers.is_active, 1)))
      .limit(1);

    if (!courier) {
      return NextResponse.json({ ok: false, error: 'Kurir tidak ditemukan' }, { status: 401 });
    }

    const pinMatch = await bcrypt.compare(pin, courier.pin_hash);
    if (!pinMatch) {
      return NextResponse.json({ ok: false, error: 'PIN salah' }, { status: 401 });
    }

    const sessionId = generateRefreshTokenId();
    const accessToken = await signAccessToken({
      sub: String(courier.id),
      role: 'courier',
      sessionId,
      name: courier.name,
    });
    const refreshToken = await signRefreshToken({
      sub: String(courier.id),
      role: 'courier',
      sessionId,
      name: courier.name,
    });

    await db.insert(courierSessions).values({
      courierId: courier.id,
      token: refreshToken,
      device_id: deviceId || null,
      is_active: true,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (deviceId && courier.device_id && courier.device_id !== deviceId) {
      console.warn(`[SECURITY] Courier ${courier.id} login dari device baru: ${deviceId}`);
    }

    await db.update(couriers).set({ device_id: deviceId || courier.device_id }).where(eq(couriers.id, courier.id));

    return NextResponse.json({
      ok: true,
      accessToken,
      refreshToken,
      courier: {
        id: courier.id,
        name: courier.name,
        phone: courier.phone,
        vehicle: courier.vehicle,
        platNo: courier.plat_no,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal login' }, { status: 500 });
  }
}
