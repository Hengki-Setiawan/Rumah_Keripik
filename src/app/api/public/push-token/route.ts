import {NextResponse} from 'next/server';
import {and, eq, isNull, sql} from 'drizzle-orm';
import {z} from 'zod';
import {cookies} from 'next/headers';
import {db} from '@/lib/db';
import {customerSessions, expoPushTokens, webOrderSession} from '@/lib/schema';
import {checkRateLimit, getClientIp} from '@/lib/rate-limit';
import {CUSTOMER_SESSION_COOKIE, hashCustomerSessionToken} from '@/lib/chat-v3/session';

const RegisterSchema = z.object({
  token: z.string().min(10).max(256),
  platform: z.enum(['android', 'ios']).default('android'),
});

export async function POST(req: Request) {
  const rate = await checkRateLimit(`push-token:${getClientIp(req)}`, 30, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak request.' }, { status: 429 });

  const parsed = RegisterSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Token tidak valid.' }, { status: 400 });

  const { token, platform } = parsed.data;

  let customerId: string | null = null;
  let orderSessionId: string | null = null;

  try {
    const cookieStore = await cookies();

    const customerToken = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
    if (customerToken) {
      const sessionTokenHash = hashCustomerSessionToken(customerToken);
      const [session] = await db
        .select({ customerId: customerSessions.customerId })
        .from(customerSessions)
        .where(and(eq(customerSessions.sessionTokenHash, sessionTokenHash), isNull(customerSessions.revokedAt)))
        .limit(1);
      if (session?.customerId) customerId = session.customerId;
    }

    const orderToken = cookieStore.get('rk_order_session')?.value;
    if (orderToken) {
      const [orderSession] = await db
        .select({ idSession: webOrderSession.id_session })
        .from(webOrderSession)
        .where(eq(webOrderSession.anonymous_token, orderToken))
        .limit(1);
      if (orderSession) orderSessionId = orderSession.idSession;
    }

    await db
      .insert(expoPushTokens)
      .values({
        token,
        customerId,
        orderSessionId,
        courierId: null,
        platform,
      })
      .onConflictDoUpdate({
        target: expoPushTokens.token,
        set: {
          customerId: customerId ?? sql`customer_id`,
          orderSessionId: orderSessionId ?? sql`order_session_id`,
          courierId: sql`courier_id`,
          lastActiveAt: sql`(datetime('now', 'utc'))`,
          platform,
        },
      });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Gagal menyimpan token.' }, { status: 500 });
  }
}
