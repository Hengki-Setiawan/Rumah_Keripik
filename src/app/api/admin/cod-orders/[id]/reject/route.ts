import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orderStatusHistory, paymentIntent, transaksi } from '@/lib/schema';
import { getAdminActor } from '@/lib/admin-actor';
import { canRejectCod } from '@/lib/order-status-policy';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const [order] = await db.select().from(transaksi).where(eq(transaksi.id_transaksi, id)).limit(1);
  if (!order) return NextResponse.json({ ok: false, error: 'Order tidak ditemukan' }, { status: 404 });
  if (order.payment_method !== 'cod') return NextResponse.json({ ok: false, error: 'Order bukan COD' }, { status: 400 });
  if (!canRejectCod(order)) return NextResponse.json({ ok: false, error: 'COD tidak bisa ditolak pada status saat ini' }, { status: 409 });
  const actor = await getAdminActor();
  await db.transaction(async (tx) => {
    await tx.update(transaksi).set({ payment_status: 'cod_rejected', order_status: 'cancelled', status_pembayaran: 'Dibatalkan', updated_at: sql`(datetime('now', 'utc'))` }).where(eq(transaksi.id_transaksi, id));
    await tx.update(paymentIntent).set({ status: 'cancelled', updated_at: sql`(datetime('now', 'utc'))` }).where(eq(paymentIntent.id_transaksi, id));
    await tx.insert(orderStatusHistory).values({ id_transaksi: id, order_status: 'cancelled', payment_status: 'cod_rejected', event_type: 'COD_REJECTED', actor });
  });
  return NextResponse.json({ ok: true });
}
