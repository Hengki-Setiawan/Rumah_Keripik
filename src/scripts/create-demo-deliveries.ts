import { db } from '../lib/db';
import {
  transaksi,
  detailTransaksi,
  deliveryAssignment,
  deliveryRoutePoint,
} from '../lib/schema';

const TODAY = new Date().toISOString().slice(0, 10); // 2026-08-06
const WAREHOUSE = { lat: '-5.1340', lng: '119.4135' };

const orders = [
  {
    id: `TX-${TODAY.replaceAll('-', '')}-901`,
    kode: `PESANAN-DEMO-901`,
    nama: 'Budi Santoso',
    hp: '081255500111',
    alamat: 'Jl. Perintis Kemerdekaan No. 12, Makassar',
    lat: '-5.1301',
    lng: '119.4778',
    jarak: '6.8',
  },
  {
    id: `TX-${TODAY.replaceAll('-', '')}-902`,
    kode: `PESANAN-DEMO-902`,
    nama: 'Siti Rahma',
    hp: '081255500222',
    alamat: 'Jl. Gunung Merapi No. 88, Makassar',
    lat: '-5.1412',
    lng: '119.4289',
    jarak: '1.9',
  },
  {
    id: `TX-${TODAY.replaceAll('-', '')}-903`,
    kode: `PESANAN-DEMO-903`,
    nama: 'Andi Wijaya',
    hp: '081255500333',
    alamat: 'Jl. Sultan Alauddin No. 45, Gowa',
    lat: '-5.1650',
    lng: '119.4520',
    jarak: '4.6',
  },
];

async function main() {
  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    const txId = o.id;

    await db
      .insert(transaksi)
      .values({
        id_transaksi: txId,
        kode_pesanan: o.kode,
        id_warung: 'WRG-001',
        tipe_penjualan: 'Online_WA',
        total_bayar: 0,
        status_pembayaran: 'Lunas',
        order_status: 'shipping',
        payment_status: 'paid',
        nama_penerima: o.nama,
        no_hp_penerima: o.hp,
        alamat_penerima: o.alamat,
        lat_pengiriman: o.lat,
        lng_pengiriman: o.lng,
        jarak_km_dari_gudang: o.jarak,
        sumber_order: 'WA',
        waktu_simpan: `${TODAY} 08:00:00`,
        updated_at: `${TODAY} 08:00:00`,
      })
      .onConflictDoNothing({ target: transaksi.id_transaksi });

    await db.insert(detailTransaksi).values([
      {
        id_transaksi: txId,
        id_produk: 'KRP-001',
        qty_terjual: 2,
        harga_snapshot: 15000,
        nama_produk_snapshot: 'Kripik Original',
        berat_gram_snapshot: 250,
        subtotal: 30000,
      },
      {
        id_transaksi: txId,
        id_produk: 'KRP-002',
        qty_terjual: 1,
        harga_snapshot: 18000,
        nama_produk_snapshot: 'Kripik Pedas',
        berat_gram_snapshot: 200,
        subtotal: 18000,
      },
    ]);

    const total = 48000;

    await db.insert(deliveryAssignment).values({
      id_transaksi: txId,
      kurir_id: 1,
      kurir_name: 'Kurir Andi',
      status: 'Siap_Dikirim',
      warehouse_id: 1,
      requires_full_pod: 0,
      pod_verified_by_otp: 0,
      delayed_notification_sent: 0,
      distance_planned_km: o.jarak,
      notes: `Pesanan demo rute ke-${i + 1}: ${o.nama}`,
      created_at: `${TODAY} 08:00:00`,
      updated_at: `${TODAY} 08:00:00`,
    });

    await db.insert(deliveryRoutePoint).values({
      route_date: TODAY,
      id_transaksi: txId,
      sequence_no: i + 1,
      lat: o.lat,
      lng: o.lng,
      address: o.alamat,
      status: 'pending',
      distance_km_from_prev: i === 0 ? o.jarak : '1.2',
      eta_minutes_from_prev: i === 0 ? 18 : 8,
    });

    console.log(`OK ${txId} ${o.kode} ${o.nama} (${o.lat},${o.lng}) seq=${i + 1}`);
  }

  console.log(`\nTotal ${orders.length} pesanan + assignment + route points untuk ${TODAY}`);
  console.log(`Warehouse: lat ${WAREHOUSE.lat}, lng ${WAREHOUSE.lng}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
