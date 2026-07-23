import { db } from '@/lib/db';
import { chatSessions, transaksi, detailTransaksi, produk, orderEvents } from '@/lib/schema';
import { and, eq, lt, sql } from 'drizzle-orm';

const EXPIRY_HOURS = 24;

export async function cleanupExpiredSessions() {
  const cutoff = new Date(Date.now() - EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  // 1. Cleanup expired chat sessions
  const expiredSessions = await db
    .select({ id: chatSessions.id, updatedAt: chatSessions.updatedAt })
    .from(chatSessions)
    .where(and(lt(chatSessions.updatedAt, cutoff), eq(chatSessions.status, 'active')));

  let archivedCount = 0;
  if (expiredSessions.length > 0) {
    await db
      .update(chatSessions)
      .set({ status: 'archived', updatedAt: sql`(datetime('now', 'utc'))` })
      .where(and(lt(chatSessions.updatedAt, cutoff), eq(chatSessions.status, 'active')));
    archivedCount = expiredSessions.length;
  }

  // 2. Cleanup expired unpaid manual transfer transactions (> 24 hours) & restock products
  const expiredOrders = await db
    .select({
      id_transaksi: transaksi.id_transaksi,
      no_wa_pelanggan: transaksi.no_wa_pelanggan,
      kode_pesanan: transaksi.kode_pesanan,
    })
    .from(transaksi)
    .where(and(lt(transaksi.waktu_simpan, cutoff), eq(transaksi.status_pembayaran, 'Menunggu_Bayar')));

  let cancelledOrdersCount = 0;
  for (const order of expiredOrders) {
    try {
      await db.transaction(async (tx) => {
        // Update order status to Dibatalkan
        await tx
          .update(transaksi)
          .set({
            status_pembayaran: 'Dibatalkan',
            order_status: 'cancelled',
            catatan: 'Dibatalkan otomatis oleh sistem (Waktu transfer > 24 jam)',
            updated_at: sql`(datetime('now', 'utc'))`,
          })
          .where(eq(transaksi.id_transaksi, order.id_transaksi));

        // Get order details to restore stock
        const items = await tx
          .select({
            id_produk: detailTransaksi.id_produk,
            qty_terjual: detailTransaksi.qty_terjual,
          })
          .from(detailTransaksi)
          .where(eq(detailTransaksi.id_transaksi, order.id_transaksi));

        // Restock warehouse stock
        for (const item of items) {
          await tx
            .update(produk)
            .set({
              stok_gudang_utama: sql`${produk.stok_gudang_utama} + ${item.qty_terjual}`,
              updated_at: sql`(datetime('now', 'utc'))`,
            })
            .where(eq(produk.id_produk, item.id_produk));
        }

        // Log event
        await tx.insert(orderEvents).values({
          no_wa_pelanggan: order.no_wa_pelanggan || '',
          id_transaksi: order.id_transaksi,
          event_type: 'ORDER_EXPIRED_AUTO_CANCEL',
          event_payload: JSON.stringify({
            reason: 'Transfer deadline 24h passed',
            kode_pesanan: order.kode_pesanan,
          }),
        });
      });

      cancelledOrdersCount++;
    } catch (err) {
      console.error(`[Cleanup] Failed to cancel order ${order.id_transaksi}:`, err);
    }
  }

  return {
    archivedSessions: archivedCount,
    cancelledExpiredOrders: cancelledOrdersCount,
  };
}

if (require.main === module) {
  cleanupExpiredSessions()
    .then((result) => console.log(`Cleanup selesai: ${result.archivedSessions} sesi diarsipkan, ${result.cancelledExpiredOrders} pesanan dibatalkan`))
    .catch((err) => console.error('Cleanup gagal:', err));
}
