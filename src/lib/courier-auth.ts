import { db } from '@/lib/db';
import { couriers, courierSessions } from '@/lib/schema';
import { eq, and, gt } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { verifyAccessToken } from '@/lib/auth-jwt';

const BCRYPT_ROUNDS = 10;

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}

async function getCourierFromDbSession(token: string) {
  const [session] = await db
    .select({
      courier: couriers,
    })
    .from(courierSessions)
    .innerJoin(couriers, eq(courierSessions.courierId, couriers.id))
    .where(
      and(
        eq(courierSessions.token, token),
        gt(courierSessions.expires_at, new Date().toISOString())
      )
    )
    .limit(1);

  if (!session) return null;

  await db
    .update(courierSessions)
    .set({ last_active_at: new Date().toISOString() })
    .where(eq(courierSessions.token, token));

  return session.courier;
}

export async function requireCourierAuth(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7);

  const jwtPayload = await verifyAccessToken(token);
  if (jwtPayload && jwtPayload.role === 'courier') {
    const courierId = parseInt(jwtPayload.sub, 10);
    if (isNaN(courierId)) return null;
    const [courier] = await db
      .select()
      .from(couriers)
      .where(and(eq(couriers.id, courierId), eq(couriers.is_active, 1)))
      .limit(1);
    return courier || null;
  }

  return getCourierFromDbSession(token);
}
