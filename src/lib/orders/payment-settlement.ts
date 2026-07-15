import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { detailTransaksi, orderStatusHistory, paymentIntent, produk, produkVarian, transaksi } from '@/lib/schema';

type StockMutationDb = Pick<typeof db, 'select' | 'update' | 'insert'>;

export async function deductStockIfNeeded(tx: StockMutationDb, orderId: string, reason: 'payment_gateway_verified' | 'payment_approved' | 'cod_approved') {
  const [stockDeducted] = await tx
    .select({ id: orderStatusHistory.id })
    .from(orderStatusHistory)
    .where(and(eq(orderStatusHistory.id_transaksi, orderId), eq(orderStatusHistory.event_type, 'STOCK_DEDUCTED')))
    .limit(1);

  if (stockDeducted) return false;

  const details = await tx.select().from(detailTransaksi).where(eq(detailTransaksi.id_transaksi, orderId));
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

  await tx.insert(orderStatusHistory).values({
    id_transaksi: orderId,
    event_type: 'STOCK_DEDUCTED',
    actor: 'system',
    metadata_json: JSON.stringify({ reason }),
  });

  return true;
}

export async function markOrderPaidFromGateway(orderId: string, note?: string | null) {
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(transaksi).where(eq(transaksi.id_transaksi, orderId)).limit(1);
    if (!order) throw new Error('Order tidak ditemukan');

    await deductStockIfNeeded(tx, orderId, 'payment_gateway_verified');

    await tx
      .update(transaksi)
      .set({
        status_pembayaran: 'Lunas',
        payment_status: 'verified',
        order_status: 'processing',
        verified_by: 'duitku_webhook',
        verified_at: sql`(datetime('now', 'utc'))`,
        updated_at: sql`(datetime('now', 'utc'))`,
        admin_note: note || order.admin_note,
      })
      .where(eq(transaksi.id_transaksi, orderId));

    await tx
      .update(paymentIntent)
      .set({
        status: 'verified',
        updated_at: sql`(datetime('now', 'utc'))`,
      })
      .where(eq(paymentIntent.id_transaksi, orderId));

    await tx.insert(orderStatusHistory).values({
      id_transaksi: orderId,
      order_status: 'processing',
      payment_status: 'verified',
      event_type: 'PAYMENT_GATEWAY_VERIFIED',
      actor: 'duitku',
      note: note || undefined,
    });
  });
}
