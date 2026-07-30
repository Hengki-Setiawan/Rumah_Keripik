import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, deliveryEvents, expoPushTokens, transaksi, customerProfile } from '@/lib/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { requireCourierAuth } from '@/lib/courier-auth';
import { sendPushNotification } from '@/lib/expo-push';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const courier = await requireCourierAuth(req);
    if (!courier) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const deliveryId = parseInt(id, 10);
    if (isNaN(deliveryId)) {
      return NextResponse.json({ ok: false, error: 'ID tidak valid' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    const [delivery] = await db.select()
      .from(deliveryAssignment)
      .where(eq(deliveryAssignment.id, deliveryId))
      .limit(1);

    if (!delivery) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    if (delivery.kurir_id !== courier.id) return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });

    await db.insert(deliveryEvents).values({
      deliveryId,
      courierId: courier.id,
      eventType: 'arrived',
      lat: body.lat || null,
      lng: body.lng || null,
      metadata: JSON.stringify({ source: body.source || 'manual' }),
    });

    // Send "hampir tiba" push notification to customer
    if (delivery.id_transaksi) {
      const [tx] = await db.select({ no_wa_pelanggan: transaksi.no_wa_pelanggan, kodePesanan: transaksi.kode_pesanan })
        .from(transaksi)
        .where(eq(transaksi.id_transaksi, delivery.id_transaksi))
        .limit(1);
      if (tx?.no_wa_pelanggan) {
        const [profile] = await db.select({ id: customerProfile.id_customer })
          .from(customerProfile)
          .where(eq(customerProfile.phone, tx.no_wa_pelanggan))
          .limit(1);
        if (profile) {
          const tokens = await db.select({ token: expoPushTokens.token })
            .from(expoPushTokens)
            .where(and(eq(expoPushTokens.customerId, profile.id), isNotNull(expoPushTokens.token)))
            .limit(5);
          if (tokens.length > 0) {
            await sendPushNotification(
              tokens.map((t) => t.token),
              'Kurir Hampir Tiba 🚚',
              `Kurir sudah sampai di lokasi! Pesanan ${tx.kodePesanan || ''} akan segera diantar.`,
              { deliveryId: id, orderId: delivery.id_transaksi, type: 'courier_arrived' }
            );
          }
        }
      }
    }

    return NextResponse.json({ ok: true, data: { message: 'Arrived recorded' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal' }, { status: 500 });
  }
}
