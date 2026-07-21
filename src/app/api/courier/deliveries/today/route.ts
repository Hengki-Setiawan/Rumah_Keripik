import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, transaksi, detailTransaksi, deliveryRoutePoint } from '@/lib/schema';
import { requireCourierAuth } from '@/lib/courier-auth';
import { eq, and, sql } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const courier = await requireCourierAuth(request);
    if (!courier) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date().toISOString().slice(0, 10);

    const deliveries = await db
      .select({
        id: deliveryAssignment.id,
        id_transaksi: deliveryAssignment.id_transaksi,
        status: deliveryAssignment.status,
        notes: deliveryAssignment.notes,
        kode_pesanan: transaksi.kode_pesanan,
        customer_name: transaksi.nama_penerima,
        customer_phone: transaksi.no_hp_penerima,
        address: transaksi.alamat_penerima,
        latitude: transaksi.lat_pengiriman,
        longitude: transaksi.lng_pengiriman,
        distance_km: transaksi.jarak_km_dari_gudang,
        route_order: deliveryRoutePoint.sequence_no,
      })
      .from(deliveryAssignment)
      .innerJoin(transaksi, eq(deliveryAssignment.id_transaksi, transaksi.id_transaksi))
      .leftJoin(
        deliveryRoutePoint,
        and(
          eq(deliveryRoutePoint.id_transaksi, deliveryAssignment.id_transaksi),
          eq(deliveryRoutePoint.route_date, today)
        )
      )
      .where(
        and(
          eq(deliveryAssignment.kurir_id, courier.id),
          sql`${deliveryAssignment.created_at} LIKE ${today + '%'}`
        )
      )
      .orderBy(deliveryRoutePoint.sequence_no);

    const items = await Promise.all(
      deliveries.map(async (d) => {
        const detailItems = await db
          .select()
          .from(detailTransaksi)
          .where(eq(detailTransaksi.id_transaksi, d.id_transaksi));
        return {
          id_transaksi: d.id_transaksi,
          items: detailItems.map((item) => ({
            name: item.nama_produk_snapshot || item.id_produk,
            quantity: item.qty_terjual,
            price: item.harga_snapshot,
          })),
        };
      })
    );

    const itemsMap = Object.fromEntries(
      items.map((i) => [i.id_transaksi, i.items])
    );

    const result = deliveries.map((d) => ({
      id: d.id,
      id_transaksi: d.id_transaksi,
      kode_pesanan: d.kode_pesanan,
      status: d.status,
      customer_name: d.customer_name || '',
      customer_phone: d.customer_phone || '',
      address: d.address || '',
      latitude: d.latitude,
      longitude: d.longitude,
      distance_km: d.distance_km,
      notes: d.notes,
      route_order: d.route_order,
      items: itemsMap[d.id_transaksi] || [],
    }));

    return NextResponse.json({ ok: true, deliveries: result });
  } catch (error) {
    console.error('[COURIER_DELIVERIES_TODAY]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
