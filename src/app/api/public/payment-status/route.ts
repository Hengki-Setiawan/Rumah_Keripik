import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { transaksi } from '@/lib/schema';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/**
 * GET /api/public/payment-status?orderId=xxx
 * Endpoint publik untuk polling status pembayaran dari QRIS card.
 * Hanya mengembalikan paymentStatus dan orderStatus — tidak ada data sensitif.
 */
export async function GET(req: Request) {
  const rate = await checkRateLimit(`payment-status:${getClientIp(req)}`, 60, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Rate limit' }, { status: 429 });

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId') || '';
  if (!orderId) return NextResponse.json({ ok: false, error: 'orderId wajib ada' }, { status: 400 });

  const [order] = await db
    .select({
      paymentStatus: transaksi.payment_status,
      orderStatus: transaksi.order_status,
    })
    .from(transaksi)
    .where(eq(transaksi.id_transaksi, orderId))
    .limit(1);

  if (!order) return NextResponse.json({ ok: false, error: 'Pesanan tidak ditemukan' }, { status: 404 });

  const isPaid =
    order.paymentStatus === 'verified' ||
    order.paymentStatus === 'paid' ||
    order.paymentStatus === 'settlement' ||
    order.paymentStatus === 'capture' ||
    order.paymentStatus === 'cod_approved';

  return NextResponse.json({
    ok: true,
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    isPaid,
  });
}
