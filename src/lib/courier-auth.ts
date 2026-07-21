import { db } from '@/lib/db';
import { couriers, courierSessions } from '@/lib/schema';
import { eq, and, gt } from 'drizzle-orm';
import crypto from 'crypto';

const SESSION_DURATION_DAYS = 30;

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function verifyCourierLogin(phone: string, pin: string) {
  const pinHash = hashPin(pin);
  const [courier] = await db
    .select()
    .from(couriers)
    .where(and(eq(couriers.phone, phone), eq(couriers.is_active, 1)))
    .limit(1);

  if (!courier) return null;
  if (courier.pin_hash !== pinHash) return null;

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
