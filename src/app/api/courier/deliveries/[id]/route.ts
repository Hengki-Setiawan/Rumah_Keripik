import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, transaksi, couriers, deliveryRoutePoint } from '@/lib/schema';
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
        createdAt: assignment.createdAt,
        notes: assignment.notes,
        routePoints: routePoints.map((rp) => ({
          lat: rp.lat,
          lng: rp.lng,
          address: rp.address,
          sequenceNo: rp.sequence_no,
        })),
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
