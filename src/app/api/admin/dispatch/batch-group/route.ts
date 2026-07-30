import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transaksi, deliveryAssignment, couriers } from '@/lib/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clusterDeliveries(deliveries: any[], maxClusterRadiusKm: number = 3) {
  const clusters: { centerLat: number; centerLng: number; deliveries: any[] }[] = [];

  for (const d of deliveries) {
    const lat = Number(d.lat);
    const lng = Number(d.lng);
    if (isNaN(lat) || isNaN(lng)) continue;

    let added = false;
    for (const cluster of clusters) {
      const dist = haversineKm(lat, lng, cluster.centerLat, cluster.centerLng);
      if (dist <= maxClusterRadiusKm) {
        cluster.deliveries.push(d);
        cluster.centerLat = (cluster.centerLat * (cluster.deliveries.length - 1) + lat) / cluster.deliveries.length;
        cluster.centerLng = (cluster.centerLng * (cluster.deliveries.length - 1) + lng) / cluster.deliveries.length;
        added = true;
        break;
      }
    }

    if (!added) {
      clusters.push({ centerLat: lat, centerLng: lng, deliveries: [d] });
    }
  }

  return clusters;
}

export async function GET() {
  try {
    await requireAdminRole('order:update');

    const maxRadius = 3;
    const pending = await db.select({
      id_transaksi: transaksi.id_transaksi,
      kode_pesanan: transaksi.kode_pesanan,
      nama_penerima: transaksi.nama_penerima,
      alamat_penerima: transaksi.alamat_penerima,
      no_hp_penerima: transaksi.no_hp_penerima,
      lat: transaksi.lat_pengiriman,
      lng: transaksi.lng_pengiriman,
      order_status: transaksi.order_status,
      created_at: transaksi.waktu_simpan,
    })
      .from(transaksi)
      .leftJoin(deliveryAssignment, eq(transaksi.id_transaksi, deliveryAssignment.id_transaksi))
      .where(
        and(
          eq(transaksi.order_status, 'shipping'),
          isNull(deliveryAssignment.id),
          sql`${transaksi.lat_pengiriman} IS NOT NULL`
        )
      )
      .orderBy(sql`${transaksi.waktu_simpan} DESC`);

    const clusters = clusterDeliveries(pending, maxRadius);

    const courierCount = await db.select({ count: sql<number>`count(*)` })
      .from(couriers)
      .where(eq(couriers.is_active, 1));

    return NextResponse.json({
      ok: true,
      data: {
        totalUnassigned: pending.length,
        totalClusters: clusters.length,
        activeCouriers: Number(courierCount[0]?.count || 0),
        clusters: clusters.map((c, i) => ({
          clusterId: i + 1,
          centerLat: Number(c.centerLat.toFixed(6)),
          centerLng: Number(c.centerLng.toFixed(6)),
          deliveryCount: c.deliveries.length,
          deliveries: c.deliveries,
        })),
      },
    });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal grouping' }, { status: 500 });
  }
}
