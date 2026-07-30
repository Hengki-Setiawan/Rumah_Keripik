import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { couriers, deliveryAssignment, courierLocations, deliveryEvents, notifications } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { validateCronRequest } from '@/lib/cron-auth';

export async function GET(req: Request) {
  const auth = validateCronRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);

    const stuckDeliveries = await db.select({
      assignmentId: deliveryAssignment.id,
      idTransaksi: deliveryAssignment.id_transaksi,
      kurirId: deliveryAssignment.kurir_id,
      kurirName: deliveryAssignment.kurir_name,
      updatedAt: deliveryAssignment.updated_at,
    })
      .from(deliveryAssignment)
      .innerJoin(couriers, eq(deliveryAssignment.kurir_id, couriers.id))
      .where(and(
        eq(deliveryAssignment.status, 'Dalam_Pengiriman'),
        sql`${deliveryAssignment.updated_at} < ${cutoff}`,
      ));

    const details: { transaksi: string; kurir: string | null }[] = [];

    for (const d of stuckDeliveries) {
      if (!d.kurirId) continue;

      const [lastLoc] = await db.select({ recordedAt: courierLocations.recordedAt })
        .from(courierLocations)
        .where(eq(courierLocations.courierId, d.kurirId))
        .orderBy(sql`${courierLocations.recordedAt} desc`)
        .limit(1);

      if (lastLoc && lastLoc.recordedAt >= cutoff) continue;

      details.push({ transaksi: d.idTransaksi, kurir: d.kurirName });

      await db.insert(notifications).values({
        courierId: d.kurirId,
        title: 'Peringatan: Kurir Berhenti Lama',
        body: `Kurir ${d.kurirName || '-'} tidak bergerak >15 menit pada pengiriman ${d.idTransaksi}`,
        type: 'system',
        relatedDeliveryId: d.assignmentId,
        createdAt: sql`(datetime('now', 'utc'))`,
      });

      await db.insert(deliveryEvents).values({
        deliveryId: d.assignmentId,
        courierId: d.kurirId,
        eventType: 'note_added',
        metadata: JSON.stringify({
          anomaly: 'stopped_long',
          lastLocation: lastLoc?.recordedAt || 'no_data',
          autoFlag: true,
        }),
        createdAt: sql`(datetime('now', 'utc'))`,
      });
    }

    return NextResponse.json({
      ok: true,
      checked: stuckDeliveries.length,
      anomalies: details.length,
      details,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
