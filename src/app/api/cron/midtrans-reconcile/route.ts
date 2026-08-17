import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orderStatusHistory, paymentIntent, transaksi } from '@/lib/schema';
import { validateCronRequest } from '@/lib/cron-auth';
import { getMidtransConfig } from '@/lib/payments/midtrans';
import { markOrderPaidFromGateway } from '@/lib/orders/payment-settlement';
import { notifyChatForOrderEvent } from '@/lib/chat-v3/order-notifications';
import { createAdminNotification } from '@/lib/admin-notifications';
import { enqueueJob } from '@/lib/worker-queue';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Rekonsiliasi: cocokkan order yang masih menunggu pembayaran (>60 menit) dengan
// status nyata di Midtrans. Webhook bisa gagal/jeda — cron ini jadi safety net
// agar order "Lunas" yang sudah dibayar tidak menggantung sebagai Menunggu_Bayar.
export async function GET(req: Request) {
  const auth = validateCronRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const config = getMidtransConfig();
  if (!config) {
    await createAdminNotification({
      category: 'system',
      title: 'Midtrans tidak dikonfigurasi',
      body: 'Reconciliation cron dilewati karena MIDTRANS_SERVER_KEY belum terisi.',
    });
    return NextResponse.json({ ok: true, skipped: 'MIDTRANS_NOT_CONFIGURED' });
  }

  try {
    const url = new URL(req.url);
    const limit = Math.min(30, Math.max(1, Number(url.searchParams.get('limit') || 10)));

    // Order online (bukan COD) yang masih menunggu pembayaran, lebih dari 60 menit.
    const pending = await db
      .select({
        id_transaksi: transaksi.id_transaksi,
        kode_pesanan: transaksi.kode_pesanan,
        payment_method: transaksi.payment_method,
      })
      .from(transaksi)
      .innerJoin(paymentIntent, eq(paymentIntent.id_transaksi, transaksi.id_transaksi))
      .where(and(
        eq(transaksi.order_status, 'awaiting_payment'),
        eq(transaksi.payment_status, 'payment_instruction_shown'),
        eq(paymentIntent.status, 'instruction_shown'),
        sql`${paymentIntent.method_type} != 'cod'`,
        sql`${transaksi.waktu_simpan} < datetime('now', '-60 minutes')`
      ))
      .limit(limit);

    let settled = 0;
    let failed = 0;
    let unchanged = 0;

    for (const order of pending) {
      const orderId = order.kode_pesanan || order.id_transaksi;
      try {
        const statusRes = await fetch(`${config.baseUrl}/v2/${encodeURIComponent(orderId)}/status`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Basic ${Buffer.from(config.serverKey + ':').toString('base64')}`,
          },
          cache: 'no-store',
        });
        if (!statusRes.ok) {
          unchanged++;
          continue;
        }
        const statusData = await statusRes.json() as {
          transaction_status?: string;
          fraud_status?: string;
          payment_type?: string;
        };
        const transactionStatus = String(statusData.transaction_status || '');
        const fraudStatus = String(statusData.fraud_status || '');
        const note = `Midtrans reconcile: status=${transactionStatus}, fraud=${fraudStatus}`;

        const isSuccess = transactionStatus === 'settlement' ||
          (transactionStatus === 'capture' && fraudStatus === 'accept');

        if (isSuccess) {
          const [current] = await db.select({ payment_status: transaksi.payment_status }).from(transaksi).where(eq(transaksi.id_transaksi, order.id_transaksi)).limit(1);
          if (current && current.payment_status !== 'verified') {
            await markOrderPaidFromGateway(order.id_transaksi, note);
            await notifyChatForOrderEvent(order.id_transaksi, 'payment_verified');
            enqueueJob('generate_invoice', { idTransaksi: order.id_transaksi }).catch(() => {});
          }
          settled++;
          await createAdminNotification({
            category: 'payment',
            title: `Pembayaran ${orderId} terkonfirmasi via rekonsiliasi`,
            body: 'Webhook tidak terdeteksi, tetapi status Midtrans sudah settlement. Order ditandai Lunas.',
            metaJson: { id_transaksi: order.id_transaksi },
          });
        } else if (transactionStatus === 'deny' || transactionStatus === 'cancel' || transactionStatus === 'expire') {
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
          failed++;
        } else {
          unchanged++;
        }
      } catch (err) {
        console.error('[MIDTRANS_RECONCILE] error checking', orderId, err);
        unchanged++;
      }
    }

    return NextResponse.json({ ok: true, checked: pending.length, settled, failed, unchanged });
  } catch (err) {
    console.error('[MIDTRANS_RECONCILE]', err);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}