import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  chatSessions,
  customerSessions,
  deliveryAssignment,
  deliveryRoutePoint,
  lokasiPelanggan,
  orderDraft,
  orderEvents,
  paymentIntent,
  ratingPelanggan,
  transaksi,
  webOrderSession,
} from '@/lib/schema';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { CUSTOMER_SESSION_COOKIE, hashCustomerSessionToken } from '@/lib/chat-v3/session';

const ORDER_SESSION_COOKIE = 'rk_order_session';

type RouteContext = { params: Promise<{ kode: string }> };

const CANCELLED_LIKE = ['cancelled', 'cod_rejected', 'rejected', 'gateway_failed'];

function canCustomerDeleteOrder(order: { order_status: string; payment_status: string; status_pembayaran: string }): boolean {
  if (CANCELLED_LIKE.includes(order.order_status)) return false;
  if (CANCELLED_LIKE.includes(order.payment_status)) return false;
  if (order.status_pembayaran === 'Lunas') return false;
  // Order sudah masuk tahap produksi/dikirim tidak boleh dihapus.
  if (['processing', 'shipping', 'completed'].includes(order.order_status)) return false;
  // Payment sudah verified / COD disetujui tidak boleh dihapus.
  if (['verified', 'settlement', 'capture', 'paid', 'cod_approved'].includes(order.payment_status)) return false;
  return true;
}

async function resolveOrderOwner() {
  const cookieStore = await cookies();
  const customerToken = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  const orderToken = cookieStore.get(ORDER_SESSION_COOKIE)?.value;

  if (customerToken) {
    const tokenHash = hashCustomerSessionToken(customerToken);
    const [customerSession] = await db
      .select()
      .from(customerSessions)
      .where(and(eq(customerSessions.sessionTokenHash, tokenHash), isNull(customerSessions.revokedAt)))
      .limit(1);
    if (customerSession?.customerId) return { customerId: customerSession.customerId };
  }

  if (orderToken) {
    const [webSession] = await db
      .select()
      .from(webOrderSession)
      .where(eq(webOrderSession.anonymous_token, orderToken))
      .limit(1);
    if (webSession?.id_session) return { orderSessionId: webSession.id_session };
  }

  return null;
}

export async function DELETE(_req: Request, context: RouteContext) {
  const rate = await checkRateLimit(`public-order-delete:${getClientIp(_req)}`, 20, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak request. Coba lagi sebentar.' }, { status: 429 });

  const { kode } = await context.params;
  const owner = await resolveOrderOwner();
  if (!owner) return NextResponse.json({ ok: false, error: 'Sesi pelanggan tidak ditemukan. Verifikasi WhatsApp dulu ya.' }, { status: 401 });

  const [order] = await db
    .select()
    .from(transaksi)
    .where(eq(transaksi.kode_pesanan, kode))
    .limit(1);

  const [orderById] = await db.select().from(transaksi).where(eq(transaksi.id_transaksi, kode)).limit(1);
  const target = order || orderById;
  if (!target) return NextResponse.json({ ok: false, error: 'Pesanan tidak ditemukan.' }, { status: 404 });

  const isOwner =
    (owner.customerId && target.id_customer === owner.customerId) ||
    (owner.orderSessionId && target.id_session === owner.orderSessionId);
  if (!isOwner) return NextResponse.json({ ok: false, error: 'Pesanan ini bukan milik kamu.' }, { status: 403 });

  if (!canCustomerDeleteOrder(target)) {
    return NextResponse.json({ ok: false, error: 'Pesanan sudah diproses dan tidak bisa dihapus. Hubungi admin untuk bantuan.' }, { status: 409 });
  }

  try {
    await db.transaction(async (tx) => {
      await tx.update(chatSessions).set({ activeOrderId: null }).where(eq(chatSessions.activeOrderId, target.id_transaksi));
      await tx.delete(orderDraft).where(eq(orderDraft.id_transaksi, target.id_transaksi));
      await tx.delete(orderEvents).where(eq(orderEvents.id_transaksi, target.id_transaksi));
      await tx.delete(ratingPelanggan).where(eq(ratingPelanggan.id_transaksi, target.id_transaksi));
      await tx.delete(lokasiPelanggan).where(eq(lokasiPelanggan.id_transaksi, target.id_transaksi));
      await tx.delete(deliveryRoutePoint).where(eq(deliveryRoutePoint.id_transaksi, target.id_transaksi));
      await tx.delete(paymentIntent).where(eq(paymentIntent.id_transaksi, target.id_transaksi));
      await tx.delete(deliveryAssignment).where(eq(deliveryAssignment.id_transaksi, target.id_transaksi));
      await tx.delete(transaksi).where(eq(transaksi.id_transaksi, target.id_transaksi));
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal menghapus pesanan.' }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
