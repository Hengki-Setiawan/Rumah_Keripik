import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { customerSessions, ratingPelanggan, transaksi, webOrderSession } from '@/lib/schema';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { CUSTOMER_SESSION_COOKIE, hashCustomerSessionToken } from '@/lib/chat-v3/session';

const RateSchema = z.object({
  orderId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  review: z.string().max(1000).optional(),
  token: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const rate = await checkRateLimit(`order-rate:${getClientIp(req)}`, 30, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak request' }, { status: 429 });

  const body = RateSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ ok: false, error: 'Data tidak valid', details: body.error.flatten() }, { status: 400 });
  }

  const { orderId, rating, review, token } = body.data;

  const [order] = await db
    .select({ id: transaksi.id_transaksi, no_wa: transaksi.no_wa_pelanggan, id_customer: transaksi.id_customer, id_session: transaksi.id_session, status_token: transaksi.status_token })
    .from(transaksi)
    .where(eq(transaksi.id_transaksi, orderId))
    .limit(1);

  if (!order) {
    return NextResponse.json({ ok: false, error: 'Order tidak ditemukan' }, { status: 404 });
  }

  const cookieStore = await cookies();
  const owned =
    Boolean(order.status_token && token && token === order.status_token) ||
    (await (async () => {
      const orderToken = cookieStore.get('rk_order_session')?.value;
      if (orderToken && order.id_session) {
        const [orderSession] = await db
          .select({ id: webOrderSession.id_session })
          .from(webOrderSession)
          .where(eq(webOrderSession.anonymous_token, orderToken))
          .limit(1);
        if (orderSession?.id === order.id_session) return true;
      }
      const customerToken = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
      if (customerToken && order.id_customer) {
        const sessionTokenHash = hashCustomerSessionToken(customerToken);
        const [session] = await db
          .select({ customerId: customerSessions.customerId })
          .from(customerSessions)
          .where(and(eq(customerSessions.sessionTokenHash, sessionTokenHash), isNull(customerSessions.revokedAt)))
          .limit(1);
        if (session?.customerId === order.id_customer) return true;
      }
      return false;
    })());

  if (!owned) {
    return NextResponse.json({ ok: false, error: 'Order bukan milik sesi ini' }, { status: 403 });
  }

  const [existing] = await db
    .select({ id: ratingPelanggan.id })
    .from(ratingPelanggan)
    .where(eq(ratingPelanggan.id_transaksi, orderId))
    .limit(1);

  if (existing) {
    await db
      .update(ratingPelanggan)
      .set({ rating, feedback_text: review || null, timestamp: new Date().toISOString() })
      .where(eq(ratingPelanggan.id, existing.id));
  } else {
    await db.insert(ratingPelanggan).values({
      no_wa_pelanggan: order.no_wa || '',
      id_transaksi: orderId,
      rating,
      feedback_text: review || null,
      timestamp: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true, message: 'Rating tersimpan' });
}
