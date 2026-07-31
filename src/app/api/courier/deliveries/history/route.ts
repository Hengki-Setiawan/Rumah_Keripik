import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, transaksi, detailTransaksi } from '@/lib/schema';
import { requireCourierAuth } from '@/lib/courier-auth';
import { eq, and, desc, sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const courier = await requireCourierAuth(req);
    if (!courier) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);
    const statusFilter = searchParams.get('status');

    const statuses = ['Terkirim', 'Gagal'];
    const statusCondition = statusFilter
      ? sql`${deliveryAssignment.status} = ${statusFilter}`
      : sql`${deliveryAssignment.status} IN (${statuses.map((s) => `'${s}'`).join(', ')})`;

    const deliveries = await db
      .select({
        id: deliveryAssignment.id,
        id_transaksi: deliveryAssignment.id_transaksi,
        status: deliveryAssignment.status,
        notes: deliveryAssignment.notes,
        created_at: deliveryAssignment.created_at,
        kode_pesanan: transaksi.kode_pesanan,
        customer_name: transaksi.nama_penerima,
        customer_phone: transaksi.no_hp_penerima,
        address: transaksi.alamat_penerima,
        latitude: transaksi.lat_pengiriman,
        longitude: transaksi.lng_pengiriman,
        distance_km: transaksi.jarak_km_dari_gudang,
      })
      .from(deliveryAssignment)
      .innerJoin(transaksi, eq(deliveryAssignment.id_transaksi, transaksi.id_transaksi))
      .where(
        and(
          eq(deliveryAssignment.kurir_id, courier.id),
          statusCondition
        )
      )
      .orderBy(desc(deliveryAssignment.created_at))
      .limit(limit)
      .offset(offset);

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

    const [{ total }] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(deliveryAssignment)
      .innerJoin(transaksi, eq(deliveryAssignment.id_transaksi, transaksi.id_transaksi))
      .where(
        and(
          eq(deliveryAssignment.kurir_id, courier.id),
          statusCondition
        )
      );

    const result = deliveries.map((d) => ({
      id: d.id,
      id_transaksi: d.id_transaksi,
      kode_pesanan: d.kode_pesanan,
      status: d.status,
      created_at: d.created_at,
      customer_name: d.customer_name || '',
      customer_phone: d.customer_phone || '',
      address: d.address || '',
      latitude: d.latitude,
      longitude: d.longitude,
      distance_km: d.distance_km,
      notes: d.notes,
      items: itemsMap[d.id_transaksi] || [],
    }));

    return NextResponse.json({
      ok: true,
      deliveries: result,
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    });
  } catch (error) {
    console.error('[COURIER_DELIVERIES_HISTORY]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
