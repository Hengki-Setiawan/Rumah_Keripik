import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, orderEvents, transaksi, courierLocations, deliveryEvents, detailTransaksi } from '@/lib/schema';
import { requireCourierAuth } from '@/lib/courier-auth';
import { CourierCompleteDeliverySchema } from '@/lib/courier-types';
import { eq, and, gte, lte, desc, sum } from 'drizzle-orm';
import { sendOrderPushNotification } from '@/lib/expo-push';
import { recordRevenue, ensureDefaultCategories } from '@/services/ledger-service';
import { insertDeliveryEvent } from '@/lib/courier-event';
import { recordCourierEarning, bumpCourierPerformanceDaily } from '@/lib/courier-earnings';
import { sumTrackedDistanceKm } from '@/lib/courier-distance';
import { createAdminNotification } from '@/lib/admin-notifications';
import { uploadToR2 } from '@/lib/r2-storage';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const courier = await requireCourierAuth(request);
    if (!courier) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const deliveryId = parseInt(id, 10);
    if (isNaN(deliveryId)) {
      return NextResponse.json({ ok: false, error: 'ID tidak valid' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = CourierCompleteDeliverySchema.safeParse({ delivery_id: deliveryId, ...body });
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid', details: parsed.error.flatten() }, { status: 400 });
    }

    const [assignment] = await db
      .select()
      .from(deliveryAssignment)
      .where(
        and(
          eq(deliveryAssignment.id, deliveryId),
          eq(deliveryAssignment.kurir_id, courier.id)
        )
      )
      .limit(1);

    if (!assignment) {
      return NextResponse.json({ ok: false, error: 'Pengiriman tidak ditemukan' }, { status: 404 });
    }

    if (assignment.status !== 'Siap_Dikirim' && assignment.status !== 'Dalam_Pengiriman') {
      return NextResponse.json({ ok: false, error: 'Pengiriman tidak bisa diselesaikan dari status ini' }, { status: 400 });
    }

    const now = new Date().toISOString();
    let signatureData = parsed.data.signature_base64 || parsed.data.signature_url;
    let proofPhoto = parsed.data.proof_url || parsed.data.proof_photo_url;

    // Simpan foto bukti ke Cloudflare R2 (10 GB Free, Zero Egress Fee) jika berupa base64
    if (proofPhoto && proofPhoto.startsWith('data:image/')) {
      try {
        const commaIdx = proofPhoto.indexOf(',');
        if (commaIdx !== -1) {
          const mime = proofPhoto.slice(5, proofPhoto.indexOf(';'));
          const ext = mime.includes('png') ? 'png' : 'jpg';
          const buffer = Buffer.from(proofPhoto.slice(commaIdx + 1), 'base64');
          const r2Res = await uploadToR2(buffer, `proofs/delivery_${deliveryId}_${Date.now()}.${ext}`, mime);
          if (r2Res.url) {
            proofPhoto = r2Res.url;
          }
        }
      } catch (r2Err) {
        console.warn('[R2_STORAGE] Fallback simpan proof:', r2Err);
      }
    }

    if (signatureData && signatureData.startsWith('data:image/')) {
      try {
        const commaIdx = signatureData.indexOf(',');
        if (commaIdx !== -1) {
          const buffer = Buffer.from(signatureData.slice(commaIdx + 1), 'base64');
          const r2Res = await uploadToR2(buffer, `signatures/delivery_${deliveryId}_${Date.now()}.png`, 'image/png');
          if (r2Res.url) {
            signatureData = r2Res.url;
          }
        }
      } catch (r2Err) {
        console.warn('[R2_STORAGE] Fallback simpan signature:', r2Err);
      }
    }

    // Jarak aktual = lintasan titik GPS kurir dari event 'started' sampai delivered_at.
    const [startEvent] = await db
      .select({ createdAt: deliveryEvents.createdAt })
      .from(deliveryEvents)
      .where(
        and(
          eq(deliveryEvents.deliveryId, deliveryId),
          eq(deliveryEvents.eventType, 'started')
        )
      )
      .orderBy(deliveryEvents.createdAt)
      .limit(1);

    const windowStart = startEvent?.createdAt || assignment.pickup_at || assignment.created_at;
    const trackedPoints = await db
      .select({ lat: courierLocations.lat, lng: courierLocations.lng })
      .from(courierLocations)
      .where(
        and(
          eq(courierLocations.courierId, courier.id),
          gte(courierLocations.recordedAt, windowStart),
          lte(courierLocations.recordedAt, now)
        )
      )
      .orderBy(desc(courierLocations.recordedAt));

    const distanceActualKm = sumTrackedDistanceKm(
      trackedPoints.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
    );
    const distanceActualStr = distanceActualKm > 0 ? String(Math.round(distanceActualKm * 10) / 10) : null;

    await db
      .update(deliveryAssignment)
      .set({
        status: 'Terkirim',
        delivered_at: now,
        proof_url: proofPhoto || assignment.proof_url,
        notes: parsed.data.notes || assignment.notes,
        signature_url: signatureData || assignment.signature_url,
        distance_actual_km: distanceActualStr ?? assignment.distance_actual_km,
        updated_at: now,
      })
      .where(eq(deliveryAssignment.id, deliveryId));

    await db
      .update(transaksi)
      .set({ order_status: 'completed', updated_at: now })
      .where(eq(transaksi.id_transaksi, assignment.id_transaksi));

    const [tx] = await db
      .select({ no_wa: transaksi.no_wa_pelanggan })
      .from(transaksi)
      .where(eq(transaksi.id_transaksi, assignment.id_transaksi))
      .limit(1);

    if (tx?.no_wa) {
      await db.insert(orderEvents).values({
        no_wa_pelanggan: tx.no_wa,
        id_transaksi: assignment.id_transaksi,
        event_type: 'DELIVERY_COMPLETED',
        event_payload: JSON.stringify({ courier_name: assignment.kurir_name, delivery_id: deliveryId }),
      });
    }

    await sendOrderPushNotification(assignment.id_transaksi, 'completed');

    await insertDeliveryEvent({
      deliveryId,
      courierId: courier.id,
      eventType: 'completed',
      metadata: { id_transaksi: assignment.id_transaksi, signature: signatureData ? 'yes' : 'no' },
    });

    try {
      const [valueRow] = await db
        .select({ totalQty: sum(detailTransaksi.qty_terjual), totalValue: sum(detailTransaksi.subtotal) })
        .from(detailTransaksi)
        .where(eq(detailTransaksi.id_transaksi, assignment.id_transaksi));
      const totalQty = Number(valueRow?.totalQty ?? 0);
      const totalValue = Number(valueRow?.totalValue ?? 0);
      await recordCourierEarning({
        courierId: courier.id,
        deliveryAssignmentId: deliveryId,
        orderId: assignment.id_transaksi,
        productCount: totalQty > 0 ? totalQty : undefined,
        baseFee: totalValue > 0 ? totalValue : undefined,
        note: totalQty > 0 ? `${totalQty} produk, nilai ${totalValue.toLocaleString('id-ID')}` : 'Otomatis dari delivery completed',
      });
      await bumpCourierPerformanceDaily(courier.id, 'completed', distanceActualKm > 0 ? distanceActualKm : undefined);
    } catch (earningErr) {
      console.error('[COURIER_COMPLETE_EARNINGS]', earningErr);
    }

    try {
      await ensureDefaultCategories();
      const [tx] = await db.select({ total: transaksi.total_bayar, customer: transaksi.id_customer }).from(transaksi).where(eq(transaksi.id_transaksi, assignment.id_transaksi)).limit(1);
      if (tx) {
        await recordRevenue(assignment.id_transaksi, tx.total);
      }
    } catch (svcErr) {
      // Jangan biarkan poin/revenue hilang diam-diam: jadwalkan retry sebagai job
      // agar worker dapat menyelesaikannya secara terpisah (idempoten oleh desain).
      console.error('[COURIER_COMPLETE_INTEGRATION]', svcErr);
      try {
        const { enqueueJob } = await import('@/lib/worker-queue');
        const [tx] = await db.select({ total: transaksi.total_bayar, customer: transaksi.id_customer }).from(transaksi).where(eq(transaksi.id_transaksi, assignment.id_transaksi)).limit(1);
        if (tx) {
          await enqueueJob('revenue_payout', {
            orderId: assignment.id_transaksi,
            customerId: tx.customer ?? null,
            totalBayar: tx.total,
            trigger: 'delivery_complete_retry',
          }, { priority: 3, maxAttempts: 5 });
        }
      } catch (enqueueErr) {
        console.error('[COURIER_COMPLETE_INTEGRATION_ENQUEUE]', enqueueErr);
      }
    }

    const [orderMeta] = await db
      .select({ kode: transaksi.kode_pesanan, paymentStatus: transaksi.payment_status, statusPembayaran: transaksi.status_pembayaran })
      .from(transaksi)
      .where(eq(transaksi.id_transaksi, assignment.id_transaksi))
      .limit(1);

    if (orderMeta?.paymentStatus === 'cod_approved' || orderMeta?.statusPembayaran === 'Piutang') {
      await createAdminNotification({
        category: 'delivery',
        title: `Pengiriman ${orderMeta.kode || assignment.id_transaksi} selesai`,
        body: 'Pembayaran COD diterima kurir di lokasi. Tandai piutang sebagai lunas di tab Daftar Piutang.',
        metaJson: { id_transaksi: assignment.id_transaksi, href: '/transaksi?tab=piutang' },
      });
    } else {
      await createAdminNotification({
        category: 'delivery',
        title: `Pengiriman ${orderMeta?.kode || assignment.id_transaksi} selesai`,
        body: 'Order telah terkirim dan selesai. Tidak ada tindak lanjut pembayaran yang diperlukan.',
        metaJson: { id_transaksi: assignment.id_transaksi, href: '/transaksi' },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[COURIER_DELIVERY_COMPLETE]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
