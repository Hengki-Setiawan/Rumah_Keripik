import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { orderEvents, webChatMessage, webOrderSession } from '@/lib/schema';
import { generateAnonymousToken, generateIdWebSession } from '@/lib/id-generator';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { parseCart, stringifyCart } from '@/lib/public-order/cart';
import { safeJsonParse, safeJsonStringify } from '@/lib/json-utils';

const SESSION_COOKIE = 'rk_order_session';

const SessionPatchSchema = z.object({
  cart: z.object({
    items: z.array(z.object({
      productId: z.string().min(1),
      variantId: z.string().min(1).optional(),
      quantity: z.number().int().min(1).max(99),
    })).max(50),
  }).optional(),
  context: z.record(z.unknown()).optional(),
});

export async function POST(req: Request) {
  const rate = checkRateLimit(`public-session:${getClientIp(req)}`, 600, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak request. Coba lagi sebentar.' }, { status: 429 });

  const cookieStore = await cookies();
  const existingToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (existingToken) {
    const [existing] = await db
      .select()
      .from(webOrderSession)
      .where(eq(webOrderSession.anonymous_token, existingToken))
      .limit(1);

    if (existing && existing.status === 'active') {
      await db
        .update(webOrderSession)
        .set({ last_event_at: sql`(datetime('now', 'utc'))`, updated_at: sql`(datetime('now', 'utc'))` })
        .where(eq(webOrderSession.id_session, existing.id_session));

      return NextResponse.json({
        ok: true,
        session: {
          id: existing.id_session,
          state: existing.current_state,
          cart: parseCart(existing.cart_json),
          context: safeJsonParse(existing.context_json, {}),
        },
        responses: [buildGreetingResponse()],
      });
    }
  }

  const id_session = generateIdWebSession();
  const anonymous_token = generateAnonymousToken();
  const greeting = buildGreetingResponse();

  await db.insert(webOrderSession).values({
    id_session,
    anonymous_token,
    current_state: 'START',
    cart_json: '{}',
    context_json: '{}',
    status: 'active',
  });

  await db.insert(webChatMessage).values({
    id_session,
    direction: 'out',
    message_type: 'quick_replies',
    text: greeting.message,
    payload_json: JSON.stringify(greeting),
  });

  await db.insert(orderEvents).values({
    no_wa_pelanggan: `web:${id_session}`,
    event_type: 'WEB_SESSION_CREATED',
    event_payload: JSON.stringify({ source: 'public_order_page' }),
  });

  const response = NextResponse.json({
    ok: true,
    session: {
      id: id_session,
      state: 'START',
      cart: { items: [] },
      context: {},
    },
    responses: [greeting],
  });

  response.cookies.set(SESSION_COOKIE, anonymous_token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}

export async function PATCH(req: Request) {
  const rate = checkRateLimit(`public-session-patch:${getClientIp(req)}`, 80, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak update session. Coba lagi sebentar.' }, { status: 429 });

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ ok: false, error: 'Session tidak ditemukan' }, { status: 401 });

  const parsed = SessionPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Data session tidak valid' }, { status: 400 });

  const [session] = await db
    .select()
    .from(webOrderSession)
    .where(eq(webOrderSession.anonymous_token, token))
    .limit(1);
  if (!session || session.status !== 'active') return NextResponse.json({ ok: false, error: 'Session tidak aktif' }, { status: 401 });

  const cart = parsed.data.cart ?? parseCart(session.cart_json);
  const context = parsed.data.context ?? safeJsonParse(session.context_json, {});
  await db
    .update(webOrderSession)
    .set({
      cart_json: stringifyCart(cart),
      context_json: safeJsonStringify(context),
      last_event_at: sql`(datetime('now', 'utc'))`,
      updated_at: sql`(datetime('now', 'utc'))`,
    })
    .where(eq(webOrderSession.id_session, session.id_session));

  return NextResponse.json({ ok: true });
}

function buildGreetingResponse() {
  return {
    type: 'quick_replies' as const,
    message: 'Halo! Mau pesan keripik hari ini? Kamu bisa lihat produk dulu tanpa login.',
    options: [
      { label: 'Lihat Produk', action: 'show_products' },
      { label: 'Cek Status Pesanan', action: 'track_order' },
      { label: 'Tanya Admin', action: 'ask_admin' },
    ],
  };
}
