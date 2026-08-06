import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, transaksi, couriers, deliveryRoutePoint, detailTransaksi } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { requireCourierAuth } from '@/lib/courier-auth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const [assignment] = await db
      .select({
        id: deliveryAssignment.id,
        idTransaksi: deliveryAssignment.id_transaksi,
        kurirId: deliveryAssignment.kurir_id,
        status: deliveryAssignment.status,
        notes: deliveryAssignment.notes,
        createdAt: deliveryAssignment.created_at,
        orderStatus: transaksi.order_status,
        kodePesanan: transaksi.kode_pesanan,
        namaPenerima: transaksi.nama_penerima,
        noHpPenerima: transaksi.no_hp_penerima,
        alamatPenerima: transaksi.alamat_penerima,
        catatan: transaksi.catatan,
        totalBayar: transaksi.total_bayar,
        statusPembayaran: transaksi.status_pembayaran,
        paymentStatus: transaksi.payment_status,
        tipePenjualan: transaksi.tipe_penjualan,
        paymentMethod: transaksi.payment_method,
      })
      .from(deliveryAssignment)
      .innerJoin(transaksi, eq(deliveryAssignment.id_transaksi, transaksi.id_transaksi))
      .where(and(eq(deliveryAssignment.id, deliveryId), eq(deliveryAssignment.kurir_id, courier.id)))
      .limit(1);

    if (!assignment) {
      return NextResponse.json({ ok: false, error: 'Pengiriman tidak ditemukan' }, { status: 404 });
    }

    const routePoints = await db
      .select()
      .from(deliveryRoutePoint)
      .where(eq(deliveryRoutePoint.id_transaksi, assignment.idTransaksi))
      .orderBy(deliveryRoutePoint.sequence_no)
      .catch(() => []);

    const items = await db
      .select()
      .from(detailTransaksi)
      .where(eq(detailTransaksi.id_transaksi, assignment.idTransaksi))
      .catch(() => []);

    const totalQty = items.reduce((sum, it) => sum + (it.qty_terjual || 0), 0);
    const totalBeratGram = items.reduce((sum, it) => sum + (it.berat_gram_snapshot || 0), 0);

    return NextResponse.json({
      ok: true,
      delivery: {
        id: assignment.id,
        idTransaksi: assignment.idTransaksi,
        status: assignment.status,
        orderStatus: assignment.orderStatus,
        kodePesanan: assignment.kodePesanan,
        namaPenerima: assignment.namaPenerima,
        noHpPenerima: assignment.noHpPenerima,
        alamatPenerima: assignment.alamatPenerima,
        catatan: assignment.catatan,
        totalBayar: assignment.totalBayar,
        statusPembayaran: assignment.statusPembayaran,
        paymentStatus: assignment.paymentStatus,
        tipePenjualan: assignment.tipePenjualan,
        paymentMethod: assignment.paymentMethod,
        createdAt: assignment.createdAt,
        notes: assignment.notes,
        totalQty,
        totalBeratGram,
        routePoints: routePoints.map((rp) => ({
          lat: rp.lat,
          lng: rp.lng,
          address: rp.address,
          sequenceNo: rp.sequence_no,
        })),
        items: items.map((it) => ({
          namaProduk: it.nama_produk_snapshot,
          varian: it.nama_varian_snapshot,
          qty: it.qty_terjual,
          harga: it.harga_snapshot,
          subtotal: it.subtotal,
          beratGram: it.berat_gram_snapshot,
        })),
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
