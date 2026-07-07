import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { detailTransaksi, orderStatusHistory, paymentIntent, produk, produkVarian, transaksi } from '@/lib/schema';
import { isUnauthorizedAdminError, requireAdminActor } from '@/lib/admin-actor';
import { canApproveCod } from '@/lib/order-status-policy';
import { notifyChatForOrderEvent } from '@/lib/chat-v3/order-notifications';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const [order] = await db.select().from(transaksi).where(eq(transaksi.id_transaksi, id)).limit(1);
  if (!order) return NextResponse.json({ ok: false, error: 'Order tidak ditemukan' }, { status: 404 });
  if (order.payment_method !== 'cod') return NextResponse.json({ ok: false, error: 'Order bukan COD' }, { status: 400 });
  if (!canApproveCod(order)) return NextResponse.json({ ok: false, error: 'COD tidak bisa di-approve pada status saat ini' }, { status: 409 });
  try {
    const actor = await requireAdminActor();
    await db.transaction(async (tx) => {
      const [stockDeducted] = await tx
        .select({ id: orderStatusHistory.id })
        .from(orderStatusHistory)
        .where(and(eq(orderStatusHistory.id_transaksi, id), eq(orderStatusHistory.event_type, 'STOCK_DEDUCTED')))
        .limit(1);

      if (!stockDeducted) {
        const details = await tx.select().from(detailTransaksi).where(eq(detailTransaksi.id_transaksi, id));
        for (const detail of details) {
          if (detail.id_varian) {
            const result = await tx
              .update(produkVarian)
              .set({ stok: sql`${produkVarian.stok} - ${detail.qty_terjual}` })
              .where(and(eq(produkVarian.id_varian, detail.id_varian), sql`${produkVarian.stok} >= ${detail.qty_terjual}`));
            if (result.rowsAffected === 0) throw new Error(`Stok varian ${detail.nama_varian_snapshot || detail.id_varian} tidak cukup`);
          } else {
            const result = await tx
              .update(produk)
              .set({ stok_gudang_utama: sql`${produk.stok_gudang_utama} - ${detail.qty_terjual}` })
              .where(and(eq(produk.id_produk, detail.id_produk), sql`${produk.stok_gudang_utama} >= ${detail.qty_terjual}`));
            if (result.rowsAffected === 0) throw new Error(`Stok produk ${detail.nama_produk_snapshot || detail.id_produk} tidak cukup`);
          }
        }
        await tx.insert(orderStatusHistory).values({ id_transaksi: id, order_status: order.order_status, payment_status: order.payment_status, event_type: 'STOCK_DEDUCTED', actor: 'system', metadata_json: JSON.stringify({ reason: 'cod_approved' }) });
      }

      await tx.update(transaksi).set({ payment_status: 'cod_approved', order_status: 'processing', status_pembayaran: 'Piutang', updated_at: sql`(datetime('now', 'utc'))` }).where(eq(transaksi.id_transaksi, id));
      await tx.update(paymentIntent).set({ status: 'verified', updated_at: sql`(datetime('now', 'utc'))` }).where(eq(paymentIntent.id_transaksi, id));
      await tx.insert(orderStatusHistory).values({ id_transaksi: id, order_status: 'processing', payment_status: 'cod_approved', event_type: 'COD_APPROVED', actor });
    });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal approve COD' }, { status: 409 });
  }
  await notifyChatForOrderEvent(id, 'order_processing');
  return NextResponse.json({ ok: true });
}
