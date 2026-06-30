import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transaksi, detailTransaksi, produk, chatLog, ratingPelanggan } from '@/lib/schema';
import { eq, and, sql, gte, desc } from 'drizzle-orm';

export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
    const todayEnd = todayStart;
    const yesterdayEnd = yesterdayStart;

    const [todayRevenue] = await db
      .select({ total: sql<number>`COALESCE(SUM(${transaksi.total_bayar}), 0)` })
      .from(transaksi)
      .where(
        and(
          eq(transaksi.status_pembayaran, 'Lunas'),
          gte(transaksi.waktu_simpan, todayStart),
        ),
      );

    const [yesterdayRevenue] = await db
      .select({ total: sql<number>`COALESCE(SUM(${transaksi.total_bayar}), 0)` })
      .from(transaksi)
      .where(
        and(
          eq(transaksi.status_pembayaran, 'Lunas'),
          gte(transaksi.waktu_simpan, yesterdayStart),
          sql`${transaksi.waktu_simpan} < ${todayStart}`,
        ),
      );

    const [todayOrders] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(transaksi)
      .where(gte(transaksi.waktu_simpan, todayStart));

    const [yesterdayOrders] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(transaksi)
      .where(
        and(
          gte(transaksi.waktu_simpan, yesterdayStart),
          sql`${transaksi.waktu_simpan} < ${todayStart}`,
        ),
      );

    const [todayChats] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(chatLog)
      .where(gte(chatLog.timestamp, todayStart));

    const [pendingVerif] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(transaksi)
      .where(eq(transaksi.status_pembayaran, 'Menunggu_Verifikasi'));

    const ranking = await db
      .select({
        nama: produk.nama_produk,
        qty: sql<number>`SUM(${detailTransaksi.qty_terjual})`,
        revenue: sql<number>`SUM(${detailTransaksi.subtotal})`,
      })
      .from(detailTransaksi)
      .innerJoin(produk, eq(detailTransaksi.id_produk, produk.id_produk))
      .groupBy(detailTransaksi.id_produk)
      .orderBy(desc(sql`SUM(${detailTransaksi.qty_terjual})`))
      .limit(5);

    const [avgRating] = await db
      .select({ avg: sql<number>`COALESCE(AVG(${ratingPelanggan.rating}), 0)` })
      .from(ratingPelanggan);

    const revenueChange = yesterdayRevenue.total > 0
      ? ((todayRevenue.total - yesterdayRevenue.total) / yesterdayRevenue.total) * 100
      : todayRevenue.total > 0 ? 100 : 0;

    const orderChange = yesterdayOrders.count > 0
      ? ((todayOrders.count - yesterdayOrders.count) / yesterdayOrders.count) * 100
      : todayOrders.count > 0 ? 100 : 0;

    return NextResponse.json({
      pendapatan_hari_ini: todayRevenue.total,
      pendapatan_kemarin: yesterdayRevenue.total,
      revenue_change: Math.round(revenueChange * 10) / 10,
      order_hari_ini: todayOrders.count,
      order_kemarin: yesterdayOrders.count,
      order_change: Math.round(orderChange * 10) / 10,
      chat_bot_hari_ini: todayChats.count,
      pending_verifikasi: pendingVerif.count,
      produk_terlaris: ranking,
      avg_rating_bot: Math.round(avgRating.avg * 10) / 10,
    });
  } catch (err) {
    console.error('[Analytics/KPI]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
