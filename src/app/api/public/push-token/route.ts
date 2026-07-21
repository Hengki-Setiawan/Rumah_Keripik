import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { expoPushTokens } from '@/lib/schema';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const RegisterSchema = z.object({
  token: z.string().min(10).max(256),
  customerId: z.string().optional(),
  orderSessionId: z.string().optional(),
  courierId: z.number().optional(),
  platform: z.enum(['android', 'ios']).default('android'),
});

export async function POST(req: Request) {
  const rate = await checkRateLimit(`push-token:${getClientIp(req)}`, 30, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak request.' }, { status: 429 });

  const parsed = RegisterSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Token tidak valid.' }, { status: 400 });

  const { token, customerId, orderSessionId, courierId, platform } = parsed.data;

  try {
    await db
      .insert(expoPushTokens)
      .values({
        token,
        customerId: customerId || null,
        orderSessionId: orderSessionId || null,
        courierId: courierId || null,
        platform,
      })
      .onConflictDoUpdate({
        target: expoPushTokens.token,
        set: {
          customerId: customerId || sql`customer_id`,
          orderSessionId: orderSessionId || sql`order_session_id`,
          courierId: courierId || sql`courier_id`,
          lastActiveAt: sql`(datetime('now', 'utc'))`,
          platform,
        },
      });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Gagal menyimpan token.' }, { status: 500 });
  }
}
