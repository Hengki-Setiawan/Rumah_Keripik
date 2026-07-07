import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transaksi, detailTransaksi, produk, chatLog, ratingPelanggan } from '@/lib/schema';
import { eq, and, sql, gte, desc } from 'drizzle-orm';

const BUSINESS_TIME_ZONE = 'Asia/Makassar';

function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  });
  const zoneName = formatter.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value || 'GMT+0';
  const match = zoneName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!match) return 0;

  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  return sign * ((hours * 60) + minutes);
}

function getDayRangeInUtc(timeZone: string, daysFromToday = 0) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);

  const localMidnightUtc = new Date(Date.UTC(year, month - 1, day + daysFromToday, 0, 0, 0, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(localMidnightUtc, timeZone);
  const start = new Date(localMidnightUtc.getTime() - (offsetMinutes * 60_000));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export async function GET() {
  try {
    const todayRange = getDayRangeInUtc(BUSINESS_TIME_ZONE, 0);
    const yesterdayRange = getDayRangeInUtc(BUSINESS_TIME_ZONE, -1);
    const todayStart = todayRange.start;
    const todayEnd = todayRange.end;
    const yesterdayStart = yesterdayRange.start;
    const yesterdayEnd = yesterdayRange.end;

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
          sql`${transaksi.waktu_simpan} < ${yesterdayEnd}`,
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
          sql`${transaksi.waktu_simpan} < ${yesterdayEnd}`,
        ),
      );

    const [todayChats] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(chatLog)
      .where(
        and(
          gte(chatLog.timestamp, todayStart),
          sql`${chatLog.timestamp} < ${todayEnd}`,
        ),
      );

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
