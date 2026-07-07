import { NextResponse } from 'next/server';
import { count, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orderEvents, paymentProof, transaksi, workerJob } from '@/lib/schema';

export async function GET() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

  const [orders30d, proofsPending, proofsAccepted, proofsRejected, ocrPending, ocrFailed, chatOrders30d] = await Promise.all([
    db.select({ total: count() }).from(transaksi).where(gte(transaksi.waktu_simpan, since)),
    db.select({ total: count() }).from(paymentProof).where(eq(paymentProof.status, 'pending')),
    db.select({ total: count() }).from(paymentProof).where(eq(paymentProof.status, 'accepted')),
    db.select({ total: count() }).from(paymentProof).where(eq(paymentProof.status, 'rejected')),
    db.select({ total: count() }).from(workerJob).where(sql`${workerJob.type} = 'payment_proof_ocr_assist' AND ${workerJob.status} = 'pending'`),
    db.select({ total: count() }).from(workerJob).where(sql`${workerJob.type} = 'payment_proof_ocr_assist' AND ${workerJob.status} = 'failed'`),
    db.select({ total: count() }).from(orderEvents).where(sql`${orderEvents.event_type} = 'CHAT_V3_ORDER_CREATED' AND ${orderEvents.created_at} >= ${since}`),
  ]);

  const recentEvents = await db
    .select({
      eventType: orderEvents.event_type,
      payload: orderEvents.event_payload,
      createdAt: orderEvents.created_at,
    })
    .from(orderEvents)
    .where(gte(orderEvents.created_at, since))
    .orderBy(desc(orderEvents.created_at))
    .limit(20);

  const recentChatOrders = await db
    .select({
      id: transaksi.id_transaksi,
      code: transaksi.kode_pesanan,
      recipient: transaksi.nama_penerima,
      total: transaksi.total_bayar,
      paymentStatus: transaksi.payment_status,
      orderStatus: transaksi.order_status,
      createdAt: transaksi.waktu_simpan,
    })
    .from(transaksi)
    .where(eq(transaksi.tipe_penjualan, 'Online_Web'))
    .orderBy(desc(transaksi.waktu_simpan))
    .limit(5);

  return NextResponse.json({
    ok: true,
    windowDays: 30,
    summary: {
      orders30d: orders30d[0]?.total ?? 0,
      chatOrders30d: chatOrders30d[0]?.total ?? 0,
      paymentProofs: {
        pending: proofsPending[0]?.total ?? 0,
        accepted: proofsAccepted[0]?.total ?? 0,
        rejected: proofsRejected[0]?.total ?? 0,
      },
      ocrJobs: {
        pending: ocrPending[0]?.total ?? 0,
        failed: ocrFailed[0]?.total ?? 0,
      },
    },
    recentChatOrders,
    recentEvents,
  });
}
