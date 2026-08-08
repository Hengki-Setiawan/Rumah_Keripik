import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { couriers, courierSessions } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { signAccessToken, signRefreshToken, generateRefreshTokenId } from '@/lib/auth-jwt';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const LoginSchema = z.object({
  phone: z.string().min(10).max(20).optional(),
  pin: z.string().min(4).max(6).regex(/^\d+$/),
  deviceId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = LoginSchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid', details: body.error.flatten() }, { status: 400 });
    }

    const { phone, pin, deviceId } = body.data;

    // Rate limit brute-force PIN per IP dan per perangkat (bila ada).
    const entityKey = deviceId && deviceId.length > 0 ? `device:${deviceId}` : 'anon';
    const rate = await checkRateLimit(`courier-login:${getClientIp(req)}:${entityKey}`, 10, 15 * 60 * 1000);
    if (!rate.ok) {
      return NextResponse.json({ ok: false, error: 'Terlalu banyak percobaan login. Coba lagi nanti.' }, { status: 429 });
    }

    let courier: typeof couriers.$inferSelect | undefined;

    if (phone) {
      [courier] = await db
        .select()
        .from(couriers)
        .where(eq(couriers.phone, phone))
        .limit(1);
    } else {
      // Login PIN-only: PIN disimpan hashed (bcrypt) jadi tidak bisa query langsung,
      // cari kurir aktif yang PIN-nya cocok.
      const active = await db.select().from(couriers).where(eq(couriers.is_active, 1));
      for (const c of active) {
        if (c.pin_hash && await bcrypt.compare(pin, c.pin_hash)) {
          courier = c;
          break;
        }
      }
    }

    if (!courier) {
      return NextResponse.json({ ok: false, error: 'PIN atau Kurir tidak ditemukan' }, { status: 401 });
    }

    // Cek PIN juga ketika login lewat phone (perilaku original)
    if (phone) {
      const pinMatch = await bcrypt.compare(pin, courier.pin_hash);
      if (!pinMatch) {
        return NextResponse.json({ ok: false, error: 'PIN salah' }, { status: 401 });
      }
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
        plat_no: courier.plat_no,
        is_active: courier.is_active,
        photo_url: courier.photo_url,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal login' }, { status: 500 });
  }
}
