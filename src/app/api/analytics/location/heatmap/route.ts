import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transaksi } from '@/lib/schema';
import { gte, sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || '7d';

  const days = period === 'today' ? 1 : period === '7d' ? 7 : 30;
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString();

  try {
    const orders = await db
      .select({
        id_transaksi: transaksi.id_transaksi,
        kode_pesanan: transaksi.kode_pesanan,
        nama_penerima: transaksi.nama_penerima,
        lat_pengiriman: transaksi.lat_pengiriman,
        lng_pengiriman: transaksi.lng_pengiriman,
        total_bayar: transaksi.total_bayar,
        status_pembayaran: transaksi.status_pembayaran,
        waktu_simpan: transaksi.waktu_simpan,
      })
      .from(transaksi)
      .where(
        sql`${transaksi.lat_pengiriman} IS NOT NULL AND ${transaksi.lng_pengiriman} IS NOT NULL AND ${transaksi.waktu_simpan} >= ${sinceStr}`
      );

    const points = orders
      .filter((o) => o.lat_pengiriman && o.lng_pengiriman)
      .map((o) => ({
        lat: parseFloat(o.lat_pengiriman!),
        lng: parseFloat(o.lng_pengiriman!),
        weight: Math.min(o.total_bayar / 50000, 5),
        kode_pesanan: o.kode_pesanan,
        nama: o.nama_penerima,
        status: o.status_pembayaran,
      }));

    const zoneMap = new Map<string, {
      nama_zona: string; lat: number; lng: number;
      total_order: number; total_nilai: number;
    }>();

    for (const order of orders) {
      if (!order.lat_pengiriman || !order.lng_pengiriman) continue;
      const lat = parseFloat(order.lat_pengiriman);
      const lng = parseFloat(order.lng_pengiriman);
      const gridLat = Math.round(lat / 0.05) * 0.05;
      const gridLng = Math.round(lng / 0.05) * 0.05;
      const key = `${gridLat},${gridLng}`;

      if (!zoneMap.has(key)) {
        zoneMap.set(key, {
          nama_zona: `Area ${gridLat.toFixed(2)},${gridLng.toFixed(2)}`,
          lat: gridLat,
          lng: gridLng,
          total_order: 0,
          total_nilai: 0,
        });
      }
      const zone = zoneMap.get(key)!;
      zone.total_order++;
      zone.total_nilai += order.total_bayar;
    }

    const zones = Array.from(zoneMap.values())
      .sort((a, b) => b.total_order - a.total_order)
      .slice(0, 6)
      .map((z) => ({
        ...z,
        nama_zona: z.nama_zona,
      }));

    return NextResponse.json({ points, zones, total: points.length });
  } catch (err) {
    console.error('[Analytics/Heatmap]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
