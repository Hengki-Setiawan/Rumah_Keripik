import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { couriers, deliveryAssignment, deliveryEvents, transaksi } from '@/lib/schema';
import { sendCourierPushNotification, sendOrderPushNotification } from '@/lib/expo-push';
import { bumpCourierPerformanceDaily } from '@/lib/courier-earnings';
import { haversineKm } from '@/lib/courier-distance';
import { witaToday } from '@/lib/wita-date';

const MAX_DISPATCH_KM = 60;

type DispatchResult = {
  scanned: number;
  assigned: number;
  skippedNoCourier: number;
  skippedNoCoord: number;
};

// Auto-dispatch: order yang sudah siap kirim (payment verified / COD approved →
// order_status='processing') TAPI belum punya delivery_assignment, otomatis
// ditugaskan ke kurir aktif terdekat dengan beban pengiriman terendah.
// Beban = jumlah deliveryAssignment aktif (Siap_Dikirim + Dalam_Pengiriman).
export async function autoDispatchReadyOrders(): Promise<DispatchResult> {
  const result: DispatchResult = { scanned: 0, assigned: 0, skippedNoCourier: 0, skippedNoCoord: 0 };

  const readyOrders = await db
    .select({
      id_transaksi: transaksi.id_transaksi,
      kode_pesanan: transaksi.kode_pesanan,
      lat: transaksi.lat_pengiriman,
      lng: transaksi.lng_pengiriman,
      nama_penerima: transaksi.nama_penerima,
      alamat: transaksi.alamat_penerima,
    })
    .from(transaksi)
    .leftJoin(deliveryAssignment, eq(deliveryAssignment.id_transaksi, transaksi.id_transaksi))
    .where(and(
      eq(transaksi.order_status, 'processing'),
      isNull(deliveryAssignment.id_transaksi),
      // Skip pesanan yang sudah masuk jalur (sistem jalur) — kurir harus memilih
      // jalurnya, bukan di-assign per-pesanan. Unique (route_date, id_transaksi).
      isNull(sql`(
        SELECT 1 FROM delivery_route_point rp
        WHERE rp.id_transaksi = transaksi.id_transaksi AND rp.route_date = ${witaToday()}
      )`)
    ));

  result.scanned = readyOrders.length;

  const activeCouriers = await db
    .select({
      id: couriers.id,
      name: couriers.name,
      last_lat: couriers.last_lat,
      last_lng: couriers.last_lng,
      last_location_at: couriers.last_location_at,
    })
    .from(couriers)
    .where(eq(couriers.is_active, 1));

  // Beban aktif per kurir (Siap_Dikirim + Dalam_Pengiriman).
  const loadRows = await db
    .select({ kurirId: deliveryAssignment.kurir_id, count: sql<number>`COUNT(*)` })
    .from(deliveryAssignment)
    .where(sql`${deliveryAssignment.status} IN ('Siap_Dikirim', 'Dalam_Pengiriman') AND ${deliveryAssignment.kurir_id} IS NOT NULL`)
    .groupBy(deliveryAssignment.kurir_id);

  const loadMap = new Map<number, number>();
  for (const row of loadRows) {
    if (row.kurirId != null) loadMap.set(row.kurirId, row.count);
  }

  const hasUsableCoord = (v: string | null) => {
    if (!v) return false;
    const n = Number(v);
    return Number.isFinite(n) && !(n === 0);
  };

  for (const order of readyOrders) {
    const orderLat = Number(order.lat);
    const orderLng = Number(order.lng);
    const orderHasCoord = hasUsableCoord(order.lat) && hasUsableCoord(order.lng);

    // Order tanpa koordinat tidak bisa dihitung jaraknya — biarkan admin assign manual.
    if (!orderHasCoord) {
      result.skippedNoCoord++;
      continue;
    }

    let best: { id: number; name: string; lat?: string | null; lng?: string | null } | null = null;
    let bestScore = Infinity;

    for (const c of activeCouriers) {
      const cLat = Number(c.last_lat);
      const cLng = Number(c.last_lng);
      if (!Number.isFinite(cLat) || !Number.isFinite(cLng) || (cLat === 0 && cLng === 0)) continue;

      const dist = haversineKm(cLat, cLng, orderLat, orderLng);
      if (dist > MAX_DISPATCH_KM) continue;

      const load = loadMap.get(c.id) ?? 0;
      const score = dist + load * 5; // beban dianggap ~5km setara per kiriman aktif
      if (score < bestScore) {
        bestScore = score;
        best = { id: c.id, name: c.name, lat: c.last_lat, lng: c.last_lng };
      }
    }

    if (!best) {
      // Tidak ada kurir dalam radius — order tetap antri sebagai 'processing'
      // dan akan ditangani pembentukan jalur (sistem jalur), bukan notifikasi admin.
      result.skippedNoCourier++;
      continue;
    }

    const now = new Date().toISOString();

    const inserted = await db
      .insert(deliveryAssignment)
      .values({
        id_transaksi: order.id_transaksi,
        kurir_id: best.id,
        kurir_name: best.name,
        status: 'Siap_Dikirim',
        created_at: now,
        updated_at: now,
      })
      .onConflictDoUpdate({
        target: deliveryAssignment.id_transaksi,
        set: { kurir_id: best.id, kurir_name: best.name, status: 'Siap_Dikirim', updated_at: now },
      })
      .returning({ id: deliveryAssignment.id });

    await db
      .update(transaksi)
      .set({ order_status: 'shipping', updated_at: now })
      .where(eq(transaksi.id_transaksi, order.id_transaksi));

    await db.insert(deliveryEvents).values({
      deliveryId: inserted[0]?.id ?? 0,
      courierId: best.id,
      eventType: 'assigned',
      metadata: JSON.stringify({ source: 'auto_dispatch', id_transaksi: order.id_transaksi }),
    }).catch(() => {});

    const kode = order.kode_pesanan || 'pesanan';
    await sendCourierPushNotification(
      best.id,
      'Pengiriman Baru (Otomatis)',
      `Ada kiriman ${kode} untuk Anda. Segera ambil di gudang.`,
      { type: 'new_delivery', id_transaksi: order.id_transaksi }
    ).catch(() => {});

    await sendOrderPushNotification(order.id_transaksi, 'shipping').catch(() => {});

    try {
      await bumpCourierPerformanceDaily(best.id, 'assigned');
    } catch (perfErr) {
      console.error('[AUTO_DISPATCH_PERFORMANCE]', perfErr);
    }

    result.assigned++;
  }

  return result;
}