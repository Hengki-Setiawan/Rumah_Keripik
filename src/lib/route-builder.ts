import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { couriers, deliveryRoutes, deliveryRoutePoint, transaksi, warehouses, zonaPengiriman } from '@/lib/schema';
import { optimizeMultiVehicle, orsEnabled } from '@/lib/courier/ors';
import { nearestNeighbor, twoOpt, routeTotalKm } from '@/lib/courier/routing';
import { haversineKm } from '@/lib/courier-distance';
import { witaToday } from '@/lib/wita-date';

interface RouteBuildResult {
  routeDate: string;
  couriersRegistered: number;
  ordersClustered: number;
  ordersWithoutCoord: number;
  routesCreated: number;
  engine: 'ors' | 'kmeans';
}

type ClusterableOrder = {
  idTransaksi: string;
  kodePesanan: string | null;
  lat: string | null;
  lng: string | null;
};

/** Tipe transaksi drizzle (libsql) — dipakai agar build jalur bersifat atomik. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Jumlah kurir TERDAFTAR (bukan aktif) ΓÇö sesuai keputusan user: jalur = kurir terdaftar. */
async function countRegisteredCouriers(): Promise<number> {
  const [row] = await db.select({ count: sql<number>`COUNT(*)` }).from(couriers);
  return row?.count ?? 0;
}

async function getWarehouseCoords(warehouseId = 1): Promise<{ lat: number; lng: number }> {
  const [wh] = await db
    .select({ lat: warehouses.lat, lng: warehouses.lng })
    .from(warehouses)
    .where(eq(warehouses.id, warehouseId))
    .limit(1);
  const lat = Number(wh?.lat);
  const lng = Number(wh?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)
    ? { lat, lng }
    : { lat: -5.105950, lng: 119.432407 };
}

/** K-means sederhana pada lat/lng ΓåÆ K klaster. Inisialisasi centroid terjauh (max-min). */
function kMeans(points: ClusterableOrder[], k: number, warehouse: { lat: number; lng: number }): Array<ClusterableOrder[]> {
  const pts = points.filter((p) => p.lat && p.lng && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)));
  if (pts.length === 0) return [];
  const kClamped = Math.max(1, Math.min(k, pts.length));
  if (kClamped === 1) return [pts];

  const coord = (p: ClusterableOrder) => ({ lat: Number(p.lat), lng: Number(p.lng) });

  // Inisialisasi centroid: titik terjauh dari gudang, lalu terjauh dari centroid terpilih.
  const centroids: Array<{ lat: number; lng: number }> = [];
  {
    const first = pts.reduce((best, p) => {
      const c = coord(p);
      return haversineKm(c.lat, c.lng, warehouse.lat, warehouse.lng) >
        haversineKm(best.lat, best.lng, warehouse.lat, warehouse.lng) ? c : best;
    }, coord(pts[0]));
    centroids.push(first);
    while (centroids.length < kClamped) {
      let farthest = centroids[0];
      let farthestDist = -1;
      for (const p of pts) {
        const c = coord(p);
        const minDist = Math.min(...centroids.map((ct) => haversineKm(c.lat, c.lng, ct.lat, ct.lng)));
        if (minDist > farthestDist) {
          farthestDist = minDist;
          farthest = c;
        }
      }
      if (farthestDist <= 0) break;
      centroids.push(farthest);
    }
  }

  const assignments = new Array(pts.length).fill(0);
  for (let iter = 0; iter < 40; iter++) {
    let changed = false;
    for (let i = 0; i < pts.length; i++) {
      const c = coord(pts[i]);
      let bestC = 0;
      let bestD = Infinity;
      for (let j = 0; j < centroids.length; j++) {
        const d = haversineKm(c.lat, c.lng, centroids[j].lat, centroids[j].lng);
        if (d < bestD) {
          bestD = d;
          bestC = j;
        }
      }
      if (assignments[i] !== bestC) {
        assignments[i] = bestC;
        changed = true;
      }
    }
    if (!changed) break;
    for (let j = 0; j < centroids.length; j++) {
      const members = pts.filter((_, i) => assignments[i] === j);
      if (members.length === 0) continue;
      const sum = members.reduce((acc, p) => {
        const c = coord(p);
        acc.lat += c.lat;
        acc.lng += c.lng;
        return acc;
      }, { lat: 0, lng: 0 });
      centroids[j] = { lat: sum.lat / members.length, lng: sum.lng / members.length };
    }
  }

  const clusters: Array<ClusterableOrder[]> = Array.from({ length: centroids.length }, () => []);
  pts.forEach((p, i) => clusters[assignments[i]].push(p));
  return clusters.filter((c) => c.length > 0);
}

/** Label wilayah dari zonaPengiriman bila centroid jatuh dalam radius zona; fallback arah kompas. */
async function labelCluster(
  cluster: ClusterableOrder[],
  warehouse: { lat: number; lng: number }
): Promise<string> {
  const withCoord = cluster.filter((p) => p.lat && p.lng);
  if (withCoord.length === 0) return 'Gudang';
  const cLat = withCoord.reduce((s, p) => s + Number(p.lat), 0) / withCoord.length;
  const cLng = withCoord.reduce((s, p) => s + Number(p.lng), 0) / withCoord.length;

  const zones = await db
    .select({ nama: zonaPengiriman.nama_zona, lat: zonaPengiriman.lat_pusat, lng: zonaPengiriman.lng_pusat, radius: zonaPengiriman.radius_km })
    .from(zonaPengiriman)
    .where(eq(zonaPengiriman.is_active, 1));
  for (const z of zones) {
    const zLat = Number(z.lat);
    const zLng = Number(z.lng);
    if (Number.isFinite(zLat) && Number.isFinite(zLng) && haversineKm(cLat, cLng, zLat, zLng) <= Number(z.radius)) {
      return z.nama;
    }
  }

  const angle = (Math.atan2(cLng - warehouse.lng, cLat - warehouse.lat) * 180) / Math.PI;
  if (angle >= -45 && angle < 45) return 'Utara';
  if (angle >= 45 && angle < 135) return 'Timur';
  if (angle >= -135 && angle < -45) return 'Barat';
  return 'Selatan';
}

async function buildSingleRoute(
  tx: Tx,
  cluster: ClusterableOrder[],
  routeDate: string,
  warehouse: { lat: number; lng: number },
  name: string,
  createdByType: 'admin' | 'system' = 'system',
  createdBy?: string
): Promise<number | null> {
  const withCoord = cluster.filter((p) => p.lat && p.lng);
  const withoutCoord = cluster.filter((p) => !p.lat || !p.lng);

  const orderedCoords = nearestNeighbor(
    withCoord.map((p) => ({ idTransaksi: p.idTransaksi, lat: Number(p.lat), lng: Number(p.lng) })),
    warehouse.lat,
    warehouse.lng
  );
  const optimized = twoOpt(orderedCoords, 50);
  const ordered = [...optimized, ...withoutCoord];
  const totalKm = routeTotalKm(optimized);

  const [inserted] = await tx
    .insert(deliveryRoutes)
    .values({
      routeDate,
      routeName: name,
      warehouseId: 1,
      status: 'open',
      stopCount: ordered.length,
      estimatedDistanceKm: String(totalKm),
      createdByType,
      createdBy: createdBy ?? null,
    })
    .returning({ id: deliveryRoutes.id });

  if (!inserted) return null;

  // Tahan race cron-vs-manual (atau cron overlap): order yang sudah terpakai di
  // jalur lain (uniq_route_point_date_tx) dilewati, bukan menggagalkan build.
  let insertedStops = 0;
  for (const [i, wp] of ordered.entries()) {
    const [row] = await tx
      .insert(deliveryRoutePoint)
      .values({
        route_date: routeDate,
        id_transaksi: wp.idTransaksi,
        route_id: inserted.id,
        sequence_no: i + 1,
        lat: String(wp.lat ?? ''),
        lng: String(wp.lng ?? ''),
        status: 'pending',
      })
      .onConflictDoNothing()
      .returning({ id: deliveryRoutePoint.id });
    if (row) insertedStops++;
  }

  // stopCount = jumlah yang BENAR-BENAR masuk (bukan total cluster awal) supaya
  // UI kurir tidak menampilkan angka stop yang tidak ada di rute.
  if (insertedStops !== ordered.length) {
    await tx.update(deliveryRoutes).set({ stopCount: insertedStops }).where(eq(deliveryRoutes.id, inserted.id));
  }
  return inserted.id;
}

/**
 * Pembentukan jalur otomatis:
 * - JUMLAH JALUR = jumlah kurir TERDAFTAR (K). Tidak ada konsep "kurir tidak ada".
 * - PARTISI: k-means(K) = primari (pasti menghasilkan K klaster disjoint bila >= K titik).
 *   ORS VROOM multi-vehicle hanya dipakai bila menghasilkan TEPAT K rute yang menutup
 *   semua job; selain itu fallback k-means (VROOM tanpa fixed-cost cenderung menggabung
 *   semua job ke 1 kendaraan, sehingga tidak menjamin K jalur).
 * - Setiap jalur di-optimasi nearestNeighbor + 2-opt, status 'open' tanpa kurir; kurir bebas claim.
 * - order_status TIDAK diubah ke 'shipping' di sini (dilakukan saat claim).
 * - Build ATOMIK (transaksi): tidak ada jalur parsial bila ada kegagalan.
 */
export async function buildRoutesForDate(routeDate?: string): Promise<RouteBuildResult> {
  const date = routeDate ?? witaToday();
  const k = await countRegisteredCouriers();
  const warehouse = await getWarehouseCoords(1);

  const readyOrders = await db
    .select({
      idTransaksi: transaksi.id_transaksi,
      kodePesanan: transaksi.kode_pesanan,
      lat: transaksi.lat_pengiriman,
      lng: transaksi.lng_pengiriman,
    })
    .from(transaksi)
    .where(and(
      eq(transaksi.order_status, 'processing'),
      isNull(sql`(
        SELECT 1 FROM delivery_route_point rp
        WHERE rp.id_transaksi = transaksi.id_transaksi AND rp.route_date = ${date}
      )`)
    ));

  // Hanya order berkoordinat yang bisa diklaster; sisanya tetap antri processing.
  const withCoord = readyOrders.filter((o) => o.lat && o.lng && Number.isFinite(Number(o.lat)) && Number.isFinite(Number(o.lng)));
  const withoutCoord = readyOrders.filter((o) => !withCoord.includes(o));
  const K = Math.max(1, Math.min(k, withCoord.length || 1));

  let clusters: Array<ClusterableOrder[]>;
  let engine: 'ors' | 'kmeans' = 'kmeans';

  if (orsEnabled() && withCoord.length > 0) {
    try {
      const result = await optimizeMultiVehicle(
        Array.from({ length: K }, (_, i) => ({
          id: i + 1,
          profile: 'driving-car' as const,
          start: [warehouse.lng, warehouse.lat],
        })),
        withCoord.map((o, idx) => ({ id: idx + 1, location: [Number(o.lng), Number(o.lat)] })),
      );
      if (result.routes && result.routes.length > 0) {
        const perRoute = new Map<number, ClusterableOrder[]>();
        for (const r of result.routes) {
          const ids: number[] = [];
          for (const step of r.steps ?? []) {
            if (step.type === 'job' && step.job != null) ids.push(step.job);
          }
          const group = ids.map((jid) => withCoord[jid - 1]).filter(Boolean);
          if (group.length > 0) perRoute.set(perRoute.size, group);
        }
        const orsClusters = [...perRoute.values()];
        // ORS hanya dipakai bila menghasilkan TEPAT K jalur yang menutup SEMUA job.
        // Tanpa fixed cost, VROOM cenderung menggabungkan semua job ke 1 kendaraan
        // → tidak menjamin K jalur untuk K kurir → fallback k-means (partisi pasti K).
        if (orsClusters.length === K && orsClusters.flat().length === withCoord.length) {
          clusters = orsClusters;
          engine = 'ors';
        } else {
          clusters = kMeans(withCoord, K, warehouse);
        }
      } else {
        clusters = kMeans(withCoord, K, warehouse);
      }
    } catch {
      clusters = kMeans(withCoord, K, warehouse);
    }
  } else {
    clusters = kMeans(withCoord, K, warehouse);
  }

// Nama jalur memakai penghitung PER TANGGAL (bukan index per-build) supaya tidak
  // ada "Jalur #1" duplikat bila build dijalankan beberapa kali pada hari sama.
  const [existingRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(deliveryRoutes)
    .where(eq(deliveryRoutes.routeDate, date));
  let nameCounter = existingRow?.count ?? 0;

  // Seluruh build bersifat ATOMIK: bila satu jalur gagal, tidak ada jalur parsial
  // yang tertinggal (open) di DB.
  let routesCreated = 0;
  await db.transaction(async (tx) => {
    for (const cluster of clusters) {
      if (cluster.length === 0) continue;
      const label = await labelCluster(cluster, warehouse);
      const name = `Jalur #${++nameCounter} \u2014 ${label}`;
      const id = await buildSingleRoute(tx, cluster, date, warehouse, name);
      if (id != null) routesCreated++;
    }
  });

  return {
    routeDate: date,
    couriersRegistered: k,
    ordersClustered: withCoord.length,
    ordersWithoutCoord: withoutCoord.length,
    routesCreated,
    engine,
  };
}
