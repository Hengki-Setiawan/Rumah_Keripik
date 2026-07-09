import { db } from '@/lib/db';
import { rateLimits } from '@/lib/schema';
import { eq, lt } from 'drizzle-orm';

export function getClientIp(req: Request) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();

  // Try Upstash Redis if configured
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    try {
      const cleanUrl = redisUrl.replace(/\/$/, "");
      const res = await fetch(`${cleanUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${redisToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', key],
          ['EXPIRE', key, Math.ceil(windowMs / 1000), 'NX'],
        ]),
      });

      if (res.ok) {
        const data = await res.json();
        const count = data[0]?.result;
        const resetAt = now + windowMs;
        if (typeof count === 'number') {
          if (count > limit) {
            return { ok: false, remaining: 0, resetAt };
          }
          return { ok: true, remaining: limit - count, resetAt };
        }
      }
    } catch (error) {
      console.error('Upstash Redis rate limit failed, falling back to SQLite:', error);
    }
  }

  // SQLite / Turso fallback
  try {
    // 1. Clean up expired keys periodically without blocking
    db.delete(rateLimits).where(lt(rateLimits.resetAt, now)).catch(() => null);

    // 2. Fetch existing rate limit record
    const [record] = await db
      .select({ count: rateLimits.count, resetAt: rateLimits.resetAt })
      .from(rateLimits)
      .where(eq(rateLimits.key, key))
      .limit(1);

    if (!record || record.resetAt <= now) {
      const resetAt = now + windowMs;
      await db
        .insert(rateLimits)
        .values({ key, count: 1, resetAt })
        .onConflictDoUpdate({
          target: rateLimits.key,
          set: { count: 1, resetAt },
        });
      return { ok: true, remaining: limit - 1, resetAt };
    }

    if (record.count >= limit) {
      return { ok: false, remaining: 0, resetAt: record.resetAt };
    }

    const newCount = record.count + 1;
    await db
      .update(rateLimits)
      .set({ count: newCount })
      .where(eq(rateLimits.key, key));

    return { ok: true, remaining: limit - newCount, resetAt: record.resetAt };
  } catch (error) {
    console.error('SQLite rate limit failed, falling back to in-memory:', error);
    return checkInMemoryRateLimit(key, limit, windowMs);
  }
}

const buckets = new Map<string, { count: number; resetAt: number }>();

function checkInMemoryRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

export async function isRateLimited(key: string, limit: number): Promise<boolean> {
  const now = Date.now();

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    try {
      const cleanUrl = redisUrl.replace(/\/$/, "");
      const res = await fetch(`${cleanUrl}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${redisToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const count = data.result ? Number(data.result) : 0;
        if (count >= limit) return true;
      }
    } catch {
      // ignore
    }
  }

  try {
    const [record] = await db
      .select({ count: rateLimits.count, resetAt: rateLimits.resetAt })
      .from(rateLimits)
      .where(eq(rateLimits.key, key))
      .limit(1);

    if (record && record.resetAt > now && record.count >= limit) {
      return true;
    }
  } catch {
    // ignore
  }

  const bucket = buckets.get(key);
  if (bucket && bucket.resetAt > now && bucket.count >= limit) {
    return true;
  }

  return false;
}
