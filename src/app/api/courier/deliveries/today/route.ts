import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {deliveryAssignment, transaksi, detailTransaksi, deliveryRoutePoint} from '@/lib/schema';
import {requireCourierAuth} from '@/lib/courier-auth';
import {eq, and, sql} from 'drizzle-orm';
import {witaToday} from '@/lib/wita-date';
import {haversineKm} from '@/lib/courier-distance';

// Semua pusat area & jarak WAJIB dari posisi GPS realtime kurir (couriers.last_lat/lng),
// BUKAN dari gudang/pusat bisnis. Tanpa GPS kurir, tidak ada filter area yang diterapkan
// pada kandidat baru (hanya hygiene null-koordinat).
const MAX_DELIVERY_KM = 60;

function inServiceArea(lat: string | null, lng: string | null, centerLat: number, centerLng: number): boolean {
  if (!lat || !lng) return false;
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return false;
  return haversineKm(la, ln, centerLat, centerLng) <= MAX_DELIVERY_KM;
}

export async function GET(request: Request) {
  try {
    const courier = await requireCourierAuth(request);
    if (!courier) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Pusat area + jarak WAJIB dari GPS realtime kurir (couriers.last_lat/lng).
    // Tanpa fix GPS: tidak ada pusat area — semua kandidat baru yang punya
    // koordinat ditampilkan apa adanya (filter radius dinonaktifkan), jarak = null.
    const centerLat = Number(courier.last_lat);
    const centerLng = Number(courier.last_lng);
    const hasGpsFix =
      Number.isFinite(centerLat) && Number.isFinite(centerLng) && !(centerLat === 0 && centerLng === 0);
    const areaLat = hasGpsFix ? centerLat : 0;
    const areaLng = hasGpsFix ? centerLng : 0;

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
          sql`(${deliveryAssignment.kurir_id} = ${courier.id} OR ${deliveryAssignment.kurir_id} IS NULL)`
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
      .filter((d) => {
        // Pesanan yang SUDAH di-assign ke kurir ini WAJIB tampil apa pun koordinatnya
        // (banyak transaksi lama tidak punya lat/lng). Hanya kandidat baru yang belum
        // di-assign yang disaring radius operasional di sekitar GPS kurir.
        if (d.id != null) return true;
        if (!hasGpsFix) return true;
        if (!d.latitude || !d.longitude) return true;
        return inServiceArea(d.latitude, d.longitude, areaLat, areaLng);
      })
      .map((d) => {
        const dlLat = Number(d.latitude);
        const dlLng = Number(d.longitude);
        const hasDeliveryCoord =
          Number.isFinite(dlLat) && Number.isFinite(dlLng) && !(dlLat === 0 && dlLng === 0);
        const distance_km = hasGpsFix && hasDeliveryCoord
          ? String(Math.round(haversineKm(centerLat, centerLng, dlLat, dlLng) * 10) / 10)
          : null;
        return {
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
          distance_km,
          notes: d.notes,
          items: (d.id_transaksi ? itemsMap[d.id_transaksi] : []) || [],
        };
      });

    return NextResponse.json({ ok: true, deliveries: result });
  } catch (error) {
    console.error('[COURIER_DELIVERIES_TODAY]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
