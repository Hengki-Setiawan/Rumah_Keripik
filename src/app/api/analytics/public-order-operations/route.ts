import { NextResponse } from 'next/server';
import { count, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orderEvents, transaksi } from '@/lib/schema';
import { requireAdminRoleOrResponse } from '@/lib/admin-actor';

export async function GET() {
  const denied = await requireAdminRoleOrResponse('audit:read');
  if (denied) return denied;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

  const [orders30d, chatOrders30d] = await Promise.all([
    db.select({ total: count() }).from(transaksi).where(gte(transaksi.waktu_simpan, since)),
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
    },
    recentChatOrders,
    recentEvents,
  });
}