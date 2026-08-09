import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliveryAssignment, transaksi, detailTransaksi, deliveryRoutePoint } from '@/lib/schema';
import { requireCourierAuth } from '@/lib/courier-auth';
import { eq, and, sql } from 'drizzle-orm';
import { witaToday, witaTodayStartIso } from '@/lib/wita-date';

// Area operasional: radius sekitar gudang Makassar (-5.1340, 119.4135).
// Filter ini menyingkirkan data sampah/smoke-test dari kota lain (Samarinda, Jakarta, dll)
// yang selama ini mencemari daftar "Rute Hari Ini".
const GUDANG_LAT = -5.1340;
const GUDANG_LNG = 119.4135;
const MAX_DELIVERY_KM = 60;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function inServiceArea(lat: string | null, lng: string | null): boolean {
  if (!lat || !lng) return false;
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return false;
  return haversineKm(la, ln, GUDANG_LAT, GUDANG_LNG) <= MAX_DELIVERY_KM;
}

export async function GET(request: Request) {
  try {
    const courier = await requireCourierAuth(request);
    if (!courier) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const today = witaToday();

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
        route_order: deliveryRoutePoint.sequence_no,
      })
      .from(transaksi)
      .leftJoin(deliveryAssignment, eq(transaksi.id_transaksi, deliveryAssignment.id_transaksi))
      .leftJoin(
        deliveryRoutePoint,
        and(
          eq(deliveryRoutePoint.id_transaksi, transaksi.id_transaksi),
          eq(deliveryRoutePoint.route_date, today)
        )
      )
      .where(
        and(
          sql`${transaksi.order_status} IN ('ready', 'confirmed', 'shipping', 'awaiting_admin_confirmation', 'Menunggu_Verifikasi')`,
          sql`(${deliveryAssignment.kurir_id} = ${courier.id} OR (${deliveryAssignment.kurir_id} IS NULL AND ${transaksi.waktu_simpan} >= ${witaTodayStartIso()}))`
        )
      )
      .orderBy(deliveryRoutePoint.sequence_no);

    const items = await Promise.all(
      deliveries.map(async (d) => {
        if (!d.id_transaksi) return { id_transaksi: '', items: [] };
        const idTx: string = d.id_transaksi;
        const detailItems = await db
          .select()
          .from(detailTransaksi)
          .where(eq(detailTransaksi.id_transaksi, idTx));
        return {
          id_transaksi: idTx,
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

    const result = deliveries
      .filter((d) => inServiceArea(d.latitude, d.longitude))
      .map((d) => ({
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
        items: (d.id_transaksi ? itemsMap[d.id_transaksi] : []) || [],
      }));

    return NextResponse.json({ ok: true, deliveries: result });
  } catch (error) {
    console.error('[COURIER_DELIVERIES_TODAY]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
