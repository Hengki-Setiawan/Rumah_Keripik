import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orderStatusHistory, paymentIntent, transaksi } from '@/lib/schema';
import { markOrderPaidFromGateway } from '@/lib/orders/payment-settlement';
import { notifyChatForOrderEvent } from '@/lib/chat-v3/order-notifications';
import { verifyMidtransNotificationSignature } from '@/lib/payments/midtrans';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: 'Invalid callback payload' }, { status: 400 });

  const orderId = String(body.order_id || '');
  const statusCode = String(body.status_code || '');
  const grossAmount = String(body.gross_amount || '');
  const transactionStatus = String(body.transaction_status || '');
  const fraudStatus = String(body.fraud_status || '');
  const paymentType = String(body.payment_type || '');
  const signatureKey = String(body.signature_key || '');

  if (!orderId || !statusCode || !grossAmount || !signatureKey) {
    return NextResponse.json({ ok: false, error: 'Bad callback parameters' }, { status: 400 });
  }

  const valid = verifyMidtransNotificationSignature({
    orderId,
    statusCode,
    grossAmount,
    signatureKey,
  });

  if (!valid) {
    return NextResponse.json({ ok: false, error: 'Bad callback signature' }, { status: 403 });
  }

  const [order] = await db
    .select()
    .from(transaksi)
    .where(eq(transaksi.kode_pesanan, orderId))
    .limit(1);

  if (!order) return NextResponse.json({ ok: true, ignored: true });

  const note = `Midtrans webhook: status=${transactionStatus}, type=${paymentType}, fraud=${fraudStatus}`;

  const isSuccess =
    transactionStatus === 'settlement' ||
    (transactionStatus === 'capture' && fraudStatus === 'accept');

  if (isSuccess) {
    if (order.payment_status !== 'verified') {
      await markOrderPaidFromGateway(order.id_transaksi, note);
      await notifyChatForOrderEvent(order.id_transaksi, 'payment_verified');
    }
    return NextResponse.json({ ok: true });
  }

  const isFailed =
    transactionStatus === 'deny' ||
    transactionStatus === 'cancel' ||
    transactionStatus === 'expire';

  if (isFailed) {
    await db.transaction(async (tx) => {
      await tx
        .update(transaksi)
        .set({
          payment_status: 'gateway_failed',
          order_status: 'awaiting_payment',
          status_pembayaran: 'Menunggu_Bayar',
          admin_note: note,
          updated_at: sql`(datetime('now', 'utc'))`,
        })
        .where(eq(transaksi.id_transaksi, order.id_transaksi));

      await tx
        .update(paymentIntent)
        .set({
          status: 'instruction_shown',
          updated_at: sql`(datetime('now', 'utc'))`,
        })
        .where(eq(paymentIntent.id_transaksi, order.id_transaksi));

      await tx.insert(orderStatusHistory).values({
        id_transaksi: order.id_transaksi,
        order_status: 'awaiting_payment',
        payment_status: 'gateway_failed',
        event_type: 'PAYMENT_GATEWAY_FAILED',
        actor: 'midtrans',
        note,
      });
    });
  }

  return NextResponse.json({ ok: true });
}
