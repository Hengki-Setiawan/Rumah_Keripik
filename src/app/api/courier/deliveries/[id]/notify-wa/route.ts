import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, deliveryEvents, transaksi } from '@/lib/schema';
import { requireCourierAuth } from '@/lib/courier-auth';
import { eq, and } from 'drizzle-orm';
import { sendTextMessage } from '@/lib/fonnte';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const courier = await requireCourierAuth(request);
    if (!courier) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const deliveryId = parseInt(id, 10);
    if (isNaN(deliveryId)) {
      return NextResponse.json({ ok: false, error: 'ID tidak valid' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const type = body.type === 'arrived' ? 'arrived' : 'arriving';

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

    const [tx] = await db
      .select({ no_wa: transaksi.no_wa_pelanggan, kodePesanan: transaksi.kode_pesanan })
      .from(transaksi)
      .where(eq(transaksi.id_transaksi, assignment.id_transaksi))
      .limit(1);

    const noWa = tx?.no_wa;
    if (!noWa) {
      return NextResponse.json({ ok: false, error: 'Nomor pelanggan tidak ditemukan' }, { status: 404 });
    }

    const kode = tx.kodePesanan || assignment.id_transaksi;
    const message =
      type === 'arriving'
        ? `🚚 *Kurir Segera Tiba*\n\nHalo kak! Pesanan *${kode}* sedang dalam perjalanan dan akan segera sampai di lokasi. Mohon bersiap ya 🙏`
        : `✅ *Pesanan Sudah Sampai*\n\nHalo kak! Pesanan *${kode}* sudah sampai di lokasi tujuan. Terima kasih 🙏`;

    const result = await sendTextMessage(noWa, message);
    if (!result.success) {
      return NextResponse.json({ ok: false, error: result.error || 'Gagal kirim WA' }, { status: 502 });
    }

    await db.insert(deliveryEvents).values({
      deliveryId,
      courierId: courier.id,
      eventType: type === 'arriving' ? 'notify_arriving' : 'notify_arrived',
      metadata: JSON.stringify({ via: 'fonnte', waId: result.id || null }),
    });

    return NextResponse.json({ ok: true, data: { message: 'Notifikasi WA terkirim', waId: result.id } });
  } catch (error) {
    console.error('[COURIER_NOTIFY_WA]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}