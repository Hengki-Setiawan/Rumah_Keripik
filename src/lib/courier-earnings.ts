import { db } from '@/lib/db';
import { courierEarnings, courierPerformanceDaily } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { witaToday } from '@/lib/wita-date';

export const COURIER_BASE_FEE = (() => {
  const raw = process.env.COURIER_BASE_FEE;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 10000;
})();

function todayKey(): string {
  return witaToday();
}

function earningId(): string {
  return `EARN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}

export async function recordCourierEarning(input: {
  courierId: number;
  deliveryAssignmentId: number;
  orderId: string;
  baseFee?: number;
  productCount?: number;
  note?: string;
}): Promise<void> {
  // Pendapatan internal = total nilai penjualan (harga × qty) yang dikirim kurir,
  // karena kurir bersifat internal (bukan mitra). baseFee diisi total subtotal
  // pesanan oleh caller (= transaksi.total_bayar).
  const baseFee = input.baseFee ?? COURIER_BASE_FEE;
  const note = input.note ?? 'Otomatis dari delivery completed';
  await db.insert(courierEarnings).values({
    id: earningId(),
    courierId: input.courierId,
    deliveryAssignmentId: input.deliveryAssignmentId,
    orderId: input.orderId,
    baseFee,
    status: 'confirmed',
    note,
  });
}

export async function bumpCourierPerformanceDaily(
  courierId: number,
  outcome: 'completed' | 'failed' | 'assigned',
  distanceKm?: number
): Promise<void> {
  const date = todayKey();
  const col = courierPerformanceDaily;
  const target = and(eq(col.courierId, courierId), eq(col.date, date));

  const existing = await db.select().from(col).where(target).limit(1);
  if (existing.length === 0) {
    await db.insert(col).values({
      courierId,
      date,
      totalAssigned: 1,
      totalCompleted: outcome === 'completed' ? 1 : 0,
      totalFailed: outcome === 'failed' ? 1 : 0,
      totalDistanceKm: distanceKm ?? 0,
      score: outcome === 'completed' ? 100 : outcome === 'failed' ? 0 : 0,
      onTimeRate: outcome === 'completed' ? 100 : 0,
    });
    return;
  }

  const row = existing[0];
  const assigned = (row.totalAssigned ?? 0) + 1;
  const completed = (row.totalCompleted ?? 0) + (outcome === 'completed' ? 1 : 0);
  const failed = (row.totalFailed ?? 0) + (outcome === 'failed' ? 1 : 0);
  await db
    .update(col)
    .set({
      totalAssigned: assigned,
      totalCompleted: completed,
      totalFailed: failed,
      totalDistanceKm: (row.totalDistanceKm ?? 0) + (distanceKm ?? 0),
      score: assigned > 0 ? Math.round((completed / assigned) * 100) : row.score ?? 0,
      onTimeRate: assigned > 0 ? Math.round((completed / assigned) * 100) : row.onTimeRate,
    })
    .where(target);
}
