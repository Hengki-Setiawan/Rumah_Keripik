import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { ratingPelanggan, transaksi } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const RateSchema = z.object({
  orderId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  review: z.string().max(1000).optional(),
});

export async function POST(req: Request) {
  const rate = await checkRateLimit(`order-rate:${getClientIp(req)}`, 30, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak request' }, { status: 429 });

  const body = RateSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ ok: false, error: 'Data tidak valid', details: body.error.flatten() }, { status: 400 });
  }

  const { orderId, rating, review } = body.data;

  const [order] = await db
    .select({ id: transaksi.id_transaksi, no_wa: transaksi.no_wa_pelanggan })
    .from(transaksi)
    .where(eq(transaksi.id_transaksi, orderId))
    .limit(1);

  if (!order) {
    return NextResponse.json({ ok: false, error: 'Order tidak ditemukan' }, { status: 404 });
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
