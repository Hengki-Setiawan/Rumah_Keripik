import { db } from '@/lib/db';
import { couriers, courierSessions } from '@/lib/schema';
import { eq, and, gt } from 'drizzle-orm';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const SESSION_DURATION_DAYS = 30;
const BCRYPT_ROUNDS = 10;

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function verifyCourierLogin(phone: string, pin: string) {
  const [courier] = await db
    .select()
    .from(couriers)
    .where(and(eq(couriers.phone, phone), eq(couriers.is_active, 1)))
    .limit(1);

  if (!courier) return null;

  const valid = await verifyPin(pin, courier.pin_hash);
  if (!valid) return null;

  return courier;
}

export async function createCourierSession(courierId: number) {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await db.insert(courierSessions).values({
    courierId,
    token,
    expires_at: expiresAt.toISOString(),
  });

  return token;
}

export async function getCourierFromToken(token: string) {
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
  return getCourierFromToken(token);
}
