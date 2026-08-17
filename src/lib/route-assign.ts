import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { deliveryRoutes, deliveryRoutePoint, deliveryAssignment, transaksi, routeOptimizationRuns } from '@/lib/schema';
import { sendCourierPushNotification, sendOrderPushNotification } from '@/lib/expo-push';
import { insertDeliveryEvent } from '@/lib/courier-event';
import { bumpCourierPerformanceDaily } from '@/lib/courier-earnings';

/** True bila pesan error SQLite berasal dari unique constraint. */
function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed|uniq_routes_active_courier_date/i.test(error.message);
}

async function logOptimizationRun(input: {
  routeDate: string;
  courierId: number;
  algorithmVersion: string;
  stopCount: number;
  estimatedDistanceKm?: string | null;
  routingEngineUsed?: string | null;
  triggeredBy: 'admin_manual' | 'courier_refresh';
}) {
  try {
    await db.insert(routeOptimizationRuns).values({
      routeDate: input.routeDate,
      courierId: input.courierId,
      algorithmVersion: input.algorithmVersion,
      stopCount: input.stopCount,
      estimatedDistanceKm: input.estimatedDistanceKm ?? null,
      routingEngineUsed: input.routingEngineUsed ?? null,
      triggeredBy: input.triggeredBy,
    });
  } catch (error) {
    // Audit log tidak boleh menggagalkan aksi utama.
    console.error('[LOG_OPTIMIZATION_RUN]', error);
  }
}

/** Claim jalur untuk kurir: set courierId, buat deliveryAssignment per stop, order→shipping. */
export async function claimRoute(routeId: number, courierId: number, source: 'admin' | 'courier', courierName?: string) {
  const [route] = await db
    .select()
    .from(deliveryRoutes)
    .where(eq(deliveryRoutes.id, routeId))
    .limit(1);
  if (!route) throw new Error('Jalur tidak ditemukan');
  if (route.status !== 'open') throw new Error('Jalur sudah diambil atau tidak open');

  // Kurir hanya boleh punya 1 jalur aktif (claimed/in_progress) pada tanggal
  // yang sama — cegah claim ganda via app atau admin.
  const [active] = await db
    .select({ id: deliveryRoutes.id })
    .from(deliveryRoutes)
    .where(and(
      eq(deliveryRoutes.courierId, courierId),
      eq(deliveryRoutes.routeDate, route.routeDate),
      eq(deliveryRoutes.status, 'claimed')
    ))
    .limit(1);
  if (active) throw new Error('Anda sudah punya jalur aktif — selesaikan dulu sebelum mengambil jalur lain');

  const [inProgress] = await db
    .select({ id: deliveryRoutes.id })
    .from(deliveryRoutes)
    .where(and(
      eq(deliveryRoutes.courierId, courierId),
      eq(deliveryRoutes.routeDate, route.routeDate),
      eq(deliveryRoutes.status, 'in_progress')
    ))
    .limit(1);
  if (inProgress) throw new Error('Anda sedang mengantar jalur lain — selesaikan dulu sebelum mengambil jalur baru');

  const now = new Date().toISOString();
  // Claim ATOMIK: hanya berhasil bila status masih 'open'. Mencegah dua kurir
  // meng-claim jalur yang sama secara bersamaan (race condition). Plus partial
  // unique index uniq_routes_active_courier_date menjaga 1 jalur aktif per
  // kurir per tanggal di level DB (TOCTOU-safe bila 2 request bersamaan).
  let claimed: Array<{ id: number }>;
  try {
    claimed = await db
      .update(deliveryRoutes)
      .set({ courierId, status: 'claimed', updatedAt: now })
      .where(and(eq(deliveryRoutes.id, routeId), eq(deliveryRoutes.status, 'open')))
      .returning({ id: deliveryRoutes.id });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error('Anda sudah punya jalur aktif — selesaikan dulu sebelum mengambil jalur lain');
    }
    throw error;
  }
  if (claimed.length === 0) throw new Error('Jalur sudah diambil kurir lain');

  const stops = await db
    .select({
      id: deliveryRoutePoint.id,
      idTransaksi: deliveryRoutePoint.id_transaksi,
      kode: transaksi.kode_pesanan,
      deliveryStatus: deliveryAssignment.status,
    })
    .from(deliveryRoutePoint)
    .leftJoin(transaksi, eq(deliveryRoutePoint.id_transaksi, transaksi.id_transaksi))
    .leftJoin(deliveryAssignment, eq(deliveryAssignment.id_transaksi, deliveryRoutePoint.id_transaksi))
    .where(eq(deliveryRoutePoint.route_id, routeId));

  let processed = 0;
  // Tulis assignment + status order dalam SATU transaksi: bila salah satu stop
  // gagal, seluruh claim di-rollback (status jalur tidak setengah-setengah).
  await db.transaction(async (tx) => {
    for (const stop of stops) {
      // JANGAN timpa stop yang sudah selesai (Terkirim/Gagal) — riwayat & revenue
      // sudah tercatat; release + claim ulang tidak boleh menghapusnya.
      if (stop.deliveryStatus === 'Terkirim' || stop.deliveryStatus === 'Gagal') continue;

      await tx
        .insert(deliveryAssignment)
        .values({
          id_transaksi: stop.idTransaksi,
          kurir_id: courierId,
          kurir_name: courierName ?? null,
          status: 'Siap_Dikirim',
          route_id: routeId,
          created_at: now,
          updated_at: now,
        })
        .onConflictDoUpdate({
          target: deliveryAssignment.id_transaksi,
          set: { kurir_id: courierId, kurir_name: courierName ?? null, status: 'Siap_Dikirim', route_id: routeId, updated_at: now },
        });

      await tx
        .update(transaksi)
        .set({ order_status: 'shipping', updated_at: now })
        .where(eq(transaksi.id_transaksi, stop.idTransaksi));

      processed++;
    }
  });

  // Side effects non-kritis dilakukan SETELAH transaksi commit.
  for (const stop of stops) {
    if (stop.deliveryStatus === 'Terkirim' || stop.deliveryStatus === 'Gagal') continue;
    const [assignment] = await db
      .select({ id: deliveryAssignment.id })
      .from(deliveryAssignment)
      .where(eq(deliveryAssignment.id_transaksi, stop.idTransaksi))
      .limit(1);
    await insertDeliveryEvent({
      deliveryId: assignment?.id ?? stop.id,
      courierId,
      eventType: 'assigned',
      metadata: { source: `${source}_route_claim`, route_id: routeId },
    });
    await sendOrderPushNotification(stop.idTransaksi, 'shipping').catch(() => {});
  }

  await sendCourierPushNotification(
    courierId,
    'Jalur Diambil',
    `Jalur "${route.routeName}" berhasil diambil (${processed} kiriman).`,
    { type: 'new_delivery', routeId: String(routeId) }
  ).catch(() => {});

  await logOptimizationRun({
    routeDate: route.routeDate,
    courierId,
    algorithmVersion: 'route-claim',
    stopCount: processed,
    triggeredBy: source === 'admin' ? 'admin_manual' : 'courier_refresh',
  });

  try {
    await bumpCourierPerformanceDaily(courierId, 'assigned');
  } catch (perfErr) {
    console.error('[CLAIM_ROUTE_PERFORMANCE]', perfErr);
  }

  return processed;
}

/** Lepas jalur kembali ke open: hapus assignment aktif, order kembali processing. */
export async function releaseRoute(routeId: number, courierId: number) {
  const [route] = await db
    .select()
    .from(deliveryRoutes)
    .where(and(eq(deliveryRoutes.id, routeId), eq(deliveryRoutes.courierId, courierId)))
    .limit(1);
  if (!route) throw new Error('Jalur tidak ditemukan atau bukan milik Anda');
  // Hanya jalur yang BELUM dimulai yang bisa dilepas. Kalau sudah in_progress,
  // stop yang sudah Terkirim/Gagal tidak boleh kehilangan riwayat & revenue.
  if (route.status === 'in_progress') throw new Error('Jalur yang sudah dimulai tidak bisa dilepas — selesaikan dulu');
  if (route.status === 'completed' || route.status === 'cancelled') throw new Error('Jalur tidak bisa dilepas');

  const now = new Date().toISOString();
  const stops = await db
    .select({
      idTransaksi: deliveryRoutePoint.id_transaksi,
      deliveryStatus: deliveryAssignment.status,
    })
    .from(deliveryRoutePoint)
    .leftJoin(deliveryAssignment, eq(deliveryAssignment.id_transaksi, deliveryRoutePoint.id_transaksi))
    .where(eq(deliveryRoutePoint.route_id, routeId));

  let released = 0;
  await db.transaction(async (tx) => {
    for (const stop of stops) {
      if (stop.deliveryStatus === 'Terkirim' || stop.deliveryStatus === 'Gagal') continue;
      await tx
        .delete(deliveryAssignment)
        .where(and(eq(deliveryAssignment.id_transaksi, stop.idTransaksi), eq(deliveryAssignment.route_id, routeId)));
      await tx
        .update(transaksi)
        .set({ order_status: 'processing', updated_at: now })
        .where(eq(transaksi.id_transaksi, stop.idTransaksi));
      released++;
    }

    await tx
      .update(deliveryRoutes)
      .set({ courierId: null, status: 'open', updatedAt: now })
      .where(eq(deliveryRoutes.id, routeId));
  });

  return released;
}

/** Batalkan jalur: release stop aktif, pertahankan stop yang sudah selesai, status=cancelled. */
export async function cancelRoute(routeId: number) {
  const [route] = await db
    .select()
    .from(deliveryRoutes)
    .where(eq(deliveryRoutes.id, routeId))
    .limit(1);
  if (!route) throw new Error('Jalur tidak ditemukan');
  if (route.status === 'completed') throw new Error('Jalur yang sudah selesai tidak bisa dibatalkan');

  const now = new Date().toISOString();
  const stops = await db
    .select({
      idTransaksi: deliveryRoutePoint.id_transaksi,
      deliveryStatus: deliveryAssignment.status,
    })
    .from(deliveryRoutePoint)
    .leftJoin(deliveryAssignment, eq(deliveryAssignment.id_transaksi, deliveryRoutePoint.id_transaksi))
    .where(eq(deliveryRoutePoint.route_id, routeId));

  let released = 0;
  await db.transaction(async (tx) => {
    for (const stop of stops) {
      if (stop.deliveryStatus === 'Terkirim' || stop.deliveryStatus === 'Gagal') continue;
      await tx
        .delete(deliveryAssignment)
        .where(and(eq(deliveryAssignment.id_transaksi, stop.idTransaksi), eq(deliveryAssignment.route_id, routeId)));
      // Hapus route_point stop aktif — kalau dibiarkan, pesanan ini akan dianggap
      // "sudah masuk jalur" dan dikecualikan selamanya dari auto-build berikutnya.
      await tx
        .delete(deliveryRoutePoint)
        .where(and(eq(deliveryRoutePoint.route_id, routeId), eq(deliveryRoutePoint.id_transaksi, stop.idTransaksi)));
      await tx
        .update(transaksi)
        .set({ order_status: 'processing', updated_at: now })
        .where(eq(transaksi.id_transaksi, stop.idTransaksi));
      released++;
    }

    await tx
      .update(deliveryRoutes)
      .set({ courierId: null, status: 'cancelled', completedAt: now, updatedAt: now })
      .where(eq(deliveryRoutes.id, routeId));
  });

  return released;
}

/** Mulai jalur: semua assignment Siap_Dikirim→Dalam_Pengiriman, order shipping. */
export async function startRoute(routeId: number, courierId: number) {
  const [route] = await db
    .select()
    .from(deliveryRoutes)
    .where(and(eq(deliveryRoutes.id, routeId), eq(deliveryRoutes.courierId, courierId)))
    .limit(1);
  if (!route) throw new Error('Jalur tidak ditemukan atau bukan milik Anda');
  if (route.status !== 'claimed') throw new Error('Jalur harus di-claim dulu sebelum mulai');

  const now = new Date().toISOString();
  const stops = await db
    .select({
      id: deliveryRoutePoint.id,
      idTransaksi: deliveryRoutePoint.id_transaksi,
      deliveryStatus: deliveryAssignment.status,
    })
    .from(deliveryRoutePoint)
    .leftJoin(deliveryAssignment, eq(deliveryAssignment.id_transaksi, deliveryRoutePoint.id_transaksi))
    .where(eq(deliveryRoutePoint.route_id, routeId));

  let started = 0;
  await db.transaction(async (tx) => {
    for (const stop of stops) {
      // JANGAN reset stop yang sudah Terkirim/Gagal — kurir bisa menyelesaikan
      // delivery langsung dari Siap_Dikirim sebelum jalur di-Start.
      if (stop.deliveryStatus === 'Terkirim' || stop.deliveryStatus === 'Gagal') continue;
      await tx
        .update(deliveryAssignment)
        .set({ status: 'Dalam_Pengiriman', pickup_at: now, updated_at: now })
        .where(and(eq(deliveryAssignment.id_transaksi, stop.idTransaksi), eq(deliveryAssignment.route_id, routeId)));
      await tx
        .update(transaksi)
        .set({ order_status: 'shipping', updated_at: now })
        .where(eq(transaksi.id_transaksi, stop.idTransaksi));
      started++;
    }

    await tx
      .update(deliveryRoutes)
      .set({ status: 'in_progress', updatedAt: now })
      .where(eq(deliveryRoutes.id, routeId));
  });

  for (const stop of stops) {
    if (stop.deliveryStatus === 'Terkirim' || stop.deliveryStatus === 'Gagal') continue;
    const [assignment] = await db
      .select({ id: deliveryAssignment.id })
      .from(deliveryAssignment)
      .where(and(eq(deliveryAssignment.id_transaksi, stop.idTransaksi), eq(deliveryAssignment.route_id, routeId)))
      .limit(1);
    await insertDeliveryEvent({
      deliveryId: assignment?.id ?? stop.id,
      courierId,
      eventType: 'started',
      metadata: { source: 'route_start', route_id: routeId },
    });
  }

  await logOptimizationRun({
    routeDate: route.routeDate,
    courierId,
    algorithmVersion: 'route-start',
    stopCount: started,
    triggeredBy: 'courier_refresh',
  });

  return stops.length;
}