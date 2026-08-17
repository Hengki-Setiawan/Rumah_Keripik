import { NextResponse } from 'next/server';
import { eq, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orderStatusHistory, paymentIntent, transaksi } from '@/lib/schema';
import { markOrderPaidFromGateway } from '@/lib/orders/payment-settlement';
import { notifyChatForOrderEvent } from '@/lib/chat-v3/order-notifications';
import { verifyMidtransNotificationSignature } from '@/lib/payments/midtrans';
import { getIdempotentResponse, saveIdempotentResponse } from '@/lib/idempotency';
import { enqueueJob } from '@/lib/worker-queue';
import { createAdminNotification } from '@/lib/admin-notifications';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: 'Invalid callback payload' }, { status: 400 });

  const orderId = String(body.order_id || '');
  const transactionStatus = String(body.transaction_status || '');

  const idempotencyKey = `midtrans:${orderId}:${transactionStatus}:${String(body.fraud_status || '')}`;
  const existing = await getIdempotentResponse(idempotencyKey);
  if (existing) return existing.response;

  const statusCode = String(body.status_code || '');
  const grossAmount = String(body.gross_amount || '');
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
    .where(or(
      eq(transaksi.kode_pesanan, orderId),
      eq(transaksi.id_transaksi, orderId)
    ))
    .limit(1);

  if (!order) {
    const ignored = NextResponse.json({ ok: true, ignored: true });
    await saveIdempotentResponse(idempotencyKey, ignored);
    return ignored;
  }

  const note = `Midtrans webhook: status=${transactionStatus}, type=${paymentType}, fraud=${fraudStatus}`;

  const isSuccess =
    transactionStatus === 'settlement' ||
    (transactionStatus === 'capture' && fraudStatus === 'accept');

  if (isSuccess) {
    if (order.payment_status !== 'verified') {
      await markOrderPaidFromGateway(order.id_transaksi, note);
      await notifyChatForOrderEvent(order.id_transaksi, 'payment_verified');
      enqueueJob('generate_invoice', { idTransaksi: order.id_transaksi }).catch(() => {});
    }
    const response = NextResponse.json({ ok: true });
    await saveIdempotentResponse(idempotencyKey, response);
    return response;
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

    const failureCopy = transactionStatus === 'expire'
      ? 'Pembayaran kakak kedaluwarsa sebelum selesai. Tenang, pesanan tidak hilang — kakak bisa lanjut bayar lagi ya.'
      : transactionStatus === 'cancel'
        ? 'Pembayaran kakak dibatalkan. Pesanan masih aman, kakak bisa coba bayar lagi dengan metode lain ya.'
        : transactionStatus === 'deny'
          ? 'Pembayaran kakak ditolak (kartu/bank kemungkinan menolak). Coba metode bayar lain atau ulangi ya, pesanan tetap aman.'
          : 'Pembayaran belum berhasil. Pesanan masih tersimpan, kakak bisa coba lagi ya.';

    await notifyChatForOrderEvent(order.id_transaksi, 'payment_rejected', { note: failureCopy });
  }

  const response = NextResponse.json({ ok: true });
  await saveIdempotentResponse(idempotencyKey, response);
  return response;
}
