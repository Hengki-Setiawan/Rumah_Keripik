import { config } from 'dotenv';
config({ path: '.env.local' });
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const TURSO_URL = process.env.TURSO_DATABASE_URL!.replace('libsql://', 'https://');
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN!;

const GUDANG_LAT = -5.134;
const GUDANG_LNG = 119.4135;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return (2 * R * Math.asin(Math.sqrt(a)));
}

async function execute(sql: string, args: unknown[] = []) {
  const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TURSO_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          type: 'execute',
          stmt: {
            sql,
            args: args.map((a) => (a === null ? { type: 'null' } : { type: 'text', value: String(a) })),
          },
        },
        { type: 'close' },
      ],
    }),
  });
  const txt = await res.text();
  const data = JSON.parse(txt);
  const r = data.results?.[0]?.response?.result;
  if (data.results?.[0]?.type === 'error') {
    throw new Error(`SQL error: ${JSON.stringify(data.results[0].error)}`);
  }
  return r;
}

async function q(sql: string, args: unknown[] = []) {
  const r = await execute(sql, args);
  return {
    affected: r?.rowsAffected ?? 0,
    cols: r?.cols ?? [],
    rows: (r?.rows ?? []).map((row: any) =>
      Object.fromEntries((r.cols as any[]).map((c: any, i: number) => [c.name, row[i]?.value ?? row[i]])),
    ),
  };
}

const today = new Date();
const ymd = today.toISOString().slice(0, 10).replace(/-/g, '');
const witaToday = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

const hex = () => randomUUID().replace(/-/g, '');
const pad3 = (n: number) => String(n).padStart(3, '0');

function esc(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function insertRow(table: string, rec: Record<string, unknown>) {
  const cols = Object.keys(rec);
  const vals = cols.map((c) => esc(rec[c])).join(', ');
  await q(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals})`);
}

async function saveBackup() {
  const tables = ['transaksi', 'detail_transaksi', 'delivery_assignment', 'delivery_route_point', 'order_status_history', 'order_events', 'payment_intent', 'lokasi_pelanggan', 'web_order_session', 'courier_earnings', 'notifications', 'tracking_events'];
  const out: Record<string, unknown[]> = {};
  for (const t of tables) {
    try {
      const res = await q(`SELECT * FROM ${t} LIMIT 5000`);
      out[t] = res.rows;
    } catch {
      out[t] = [];
    }
  }
  const tmp = path.join(process.env.TMP || 'C:\\Users\\ADMINI~1\\AppData\\Local\\Temp\\opencode', `rk-seed-backup-${ymd}-${hex().slice(0, 8)}.json`);
  fs.writeFileSync(tmp, JSON.stringify(out, null, 1));
  console.log(`Backup -> ${tmp}`);
}

async function purgeOrders() {
  await q(`PRAGMA foreign_keys = OFF`);
  const order = [
    'delivery_route_point', 'delivery_assignment', 'courier_earnings', 'notifications',
    'tracking_events', 'order_status_history', 'payment_intent', 'order_events',
    'lokasi_pelanggan', 'detail_transaksi', 'web_order_session', 'web_chat_message',
  ];
  let deleted = 0;
  for (const t of order) {
    try {
      const r = await q(`DELETE FROM ${t}`);
      deleted += r.affected;
      console.log(`purge ${t}: ${r.affected}`);
    } catch (e) {
      console.log(`purge ${t}: SKIP (${(e as Error).message.slice(0, 80)})`);
    }
  }
  const tx = await q(`DELETE FROM transaksi`);
  deleted += tx.affected;
  console.log(`purge transaksi: ${tx.affected} (total ${deleted})`);
  await q(`PRAGMA foreign_keys = ON`);
}

// ── Definisi pesanan realistis Makassar (2–12 km dari gudang) ──
interface SeedOrder {
  name: string;
  phone: string;
  address: string;
  landmark?: string;
  note?: string;
  lat: number;
  lng: number;
  courierId: number;
  courierName: string;
  items: { id_produk: string; nama: string; harga: number; qty: number }[];
  status: 'shipping' | 'ready'; // assignment status
  color?: string;
}

function kmFromGudang(lat: number, lng: number): number {
  return haversineKm(lat, lng, GUDANG_LAT, GUDANG_LNG);
}

const ORDERS: SeedOrder[] = [
  {
    name: 'Ibu Nurhaliza',
    phone: '081234000001',
    address: 'Jl. Poros Malino KM 8, Kel. Bonto Makkio, Kab. Gowa',
    lat: -5.3200, lng: 119.5100, // Gowa
    courierId: 1, courierName: 'Budi',
    items: [{ id_produk: 'KRP-001', nama: 'Kripik Original', harga: 15000, qty: 2 }],
    status: 'shipping',
  },
  {
    name: 'Pak Andi Saputra',
    phone: '081234000002',
    address: 'Jl. Perintis Kemerdekaan, Komp. Univ. Hasanuddin, Makassar',
    lat: -5.1275, lng: 119.4880, // UNHAS
    courierId: 1, courierName: 'Budi',
    items: [{ id_produk: 'KRP-002', nama: 'Kripik Pedas', harga: 18000, qty: 1 }, { id_produk: 'KRP-004', nama: 'Kripik Mix Bumbu', harga: 20000, qty: 1 }],
    status: 'shipping',
  },
  {
    name: 'Bu Rahayu',
    phone: '081234000003',
    address: 'Jl. Gunung Agung No. 44, Kec. Rappokino, Makassar',
    lat: -5.1344, lng: 119.4190, // Rappokini ~ gudang
    courierId: 1, courierName: 'Budi',
    items: [{ id_produk: 'KRP-003', nama: 'Kripik Bawang', harga: 17000, qty: 3 }],
    status: 'ready',
  },
  {
    name: 'Bpk. Syamsuar',
    phone: '081234000004',
    address: 'Jl. Perintis Kemerdekaan KM 15, Daya, Makassar',
    lat: -5.1086, lng: 119.4972, // Daya
    courierId: 1, courierName: 'Budi',
    items: [{ id_produk: 'KRP-004', nama: 'Kripik Mix Bumbu', harga: 20000, qty: 2 }, { id_produk: 'KRP-001', nama: 'Kripik Original', harga: 15000, qty: 1 }],
    status: 'shipping',
  },
  {
    name: 'Ibu Kartini',
    phone: '081234000005',
    address: 'Jl. A.P. Pettarani, Kec. Panakkukan, Makassar',
    lat: -5.1471, lng: 119.4666, // Panakkukan
    courierId: 2, courierName: 'Budi Kurir',
    items: [{ id_produk: 'KRP-002', nama: 'Kripik Pedas', harga: 18000, qty: 2 }],
    note: 'Titip di pos satpam',
    status: 'shipping',
  },
];

// ── Insert per pesanan (identik alur /api/order/web, metode COD) ──
let seq = 0;

async function createWebOrder(o: SeedOrder) {
  seq += 1;
  const idTransaksi = `TX-${ymd}-${pad3(seq)}`;
  const kodePesanan = `PESANAN-SEED-${String(600000 + seq * 17).slice(-6)}`;
  const idCustomer = `CUS-${ymd}-${hex().slice(0, 8).toUpperCase()}`;
  const idSession = `WOS-${randomUUID()}`;
  const anon = hex() + hex();
  const token = hex();
  const total = o.items.reduce((s, i) => s + i.harga * i.qty, 0);
  const km = kmFromGudang(o.lat, o.lng);
  const nota = o.note ? `Patokan: ${o.note}` : '';

  await insertRow('pelanggan_chatbot', {
    no_wa_pelanggan: o.phone,
    nama_pelanggan: o.name,
    alamat_pengiriman: o.address,
    channel: 'wa',
    tags: JSON.stringify(['konsumen', 'web-order']),
  });
  await insertRow('customer_profile', {
    id_customer: idCustomer,
    nama: o.name,
    phone: o.phone,
    tags_json: '["konsumen","web-order"]',
  });
  const addr = await q(`SELECT COALESCE(MAX(id_address),0)+1 AS n FROM customer_address`);
  const idAddress = Number(addr.rows[0]?.n ?? 1);
  await insertRow('customer_address', {
    id_address: idAddress, id_customer: idCustomer, label: 'Alamat utama',
    recipient_name: o.name, phone: o.phone, address_text: o.address,
    latitude: String(o.lat), longitude: String(o.lng),
    location_source: 'map_picker', is_default: 1,
  });
  await insertRow('web_order_session', {
    id_session: idSession, anonymous_token: idSession.toLowerCase(), id_customer: idCustomer,
    current_state: 'ORDER_CREATED', cart_json: '{}', context_json: '{}', status: 'completed',
  });
  await insertRow('transaksi', {
    id_transaksi: idTransaksi, no_wa_pelanggan: o.phone, id_customer: idCustomer,
    id_session: idSession, id_address: idAddress, tipe_penjualan: 'Online_Web',
    total_bayar: total, status_pembayaran: 'Menunggu_Verifikasi', kode_pesanan: kodePesanan,
    status_token: token, catatan: `Order web (web)\nMetode: COD (Bayar di Tempat)`,
    nama_penerima: o.name, alamat_penerima: o.address, no_hp_penerima: o.phone,
    sumber_order: 'WA', lat_pengiriman: String(o.lat), lng_pengiriman: String(o.lng),
    jarak_km_dari_gudang: km.toFixed(2), order_status: 'awaiting_admin_confirmation',
    payment_status: 'cod_requested', payment_method: 'cod',
    shipping_address_snapshot: JSON.stringify({ text: o.address, recipientName: o.name, phone: o.phone }),
    shipping_location_json: JSON.stringify({ lat: String(o.lat), lng: String(o.lng), source: 'maps_link' }),
  });
  for (const it of o.items) {
    await insertRow('detail_transaksi', {
      id_transaksi: idTransaksi, id_produk: it.id_produk, qty_terjual: it.qty,
      harga_snapshot: it.harga, nama_produk_snapshot: it.nama, berat_gram_snapshot: 200, subtotal: it.harga * it.qty,
    });
  }
  await insertRow('lokasi_pelanggan', {
    no_wa_pelanggan: o.phone, lat: String(o.lat), lng: String(o.lng),
    alamat_teks: o.address, source: 'maps_link', is_verified: 0, id_transaksi: idTransaksi,
  });
  await insertRow('order_events', {
    no_wa_pelanggan: o.phone, id_transaksi: idTransaksi, event_type: 'WEB_ORDER_CREATED',
    event_payload: JSON.stringify({ kode_pesanan: kodePesanan, total_bayar: total }),
  });
  await insertRow('order_events', {
    no_wa_pelanggan: o.phone, id_transaksi: idTransaksi, event_type: 'MENUNGGU_KONFIRMASI_ADMIN',
    event_payload: JSON.stringify({ status_pembayaran: 'Menunggu_Verifikasi' }),
  });
  await insertRow('payment_intent', {
    id_payment_intent: `PI-${ymd}-${pad3(seq)}`, id_transaksi: idTransaksi,
    id_payment_method: 'PM-COD-PERMANENT', method_type: 'cod', amount_due: total,
    status: 'awaiting_admin_verification',
  });
  await insertRow('order_status_history', {
    id_transaksi: idTransaksi, order_status: 'awaiting_admin_confirmation',
    payment_status: 'cod_requested', event_type: 'WEB_ORDER_CREATED', actor: 'customer',
  });
  return { idTransaksi };
}

// Approve COD + assign kurir + route point (identik alur admin)
async function approveAndAssign(idTransaksi: string, o: SeedOrder, routeOrder: number) {
  await insertRow('order_status_history', {
    id_transaksi: idTransaksi, order_status: 'awaiting_admin_confirmation',
    payment_status: 'cod_requested', event_type: 'STOCK_DEDUCTED', actor: 'system',
    metadata_json: JSON.stringify({ reason: 'cod_approved' }),
  });
  await q(`UPDATE transaksi SET payment_status='cod_approved', order_status='shipping', status_pembayaran='Piutang' WHERE id_transaksi = ?`, [idTransaksi]);
  await q(`UPDATE payment_intent SET status='verified' WHERE id_transaksi = ?`, [idTransaksi]);
  await insertRow('order_status_history', {
    id_transaksi: idTransaksi, order_status: 'shipping',
    payment_status: 'cod_approved', event_type: 'COD_APPROVED', actor: 'admin',
  });
  await insertRow('delivery_assignment', {
    id_transaksi: idTransaksi, kurir_id: o.courierId, kurir_name: o.courierName,
    status: o.status === 'ready' ? 'Siap_Dikirim' : 'Dalam_Pengiriman',
    warehouse_id: 1, distance_planned_km: kmFromGudang(o.lat, o.lng).toFixed(2),
  });
  await insertRow('delivery_route_point', {
    route_date: witaToday, id_transaksi: idTransaksi, sequence_no: routeOrder,
    lat: String(o.lat), lng: String(o.lng), address: o.address, status: 'pending',
  });
  await insertRow('order_events', {
    no_wa_pelanggan: o.phone, id_transaksi: idTransaksi, event_type: 'PESANAN_DIKIRIM',
    event_payload: JSON.stringify({ kode_pesanan: idTransaksi }),
  });
  return { ok: true };
}

// ── MAIN ──
async function main() {
  console.log('Backup dulu...');
  await saveBackup();
  console.log('Purge data pesanan...');
  await purgeOrders();

  console.log('Seed pesanan baru...');
  let routeNo = 0;
  for (const o of ORDERS) {
    routeNo += 1;
    const { idTransaksi } = await createWebOrder(o);
    await approveAndAssign(idTransaksi, o, routeNo);
    console.log(`  ${idTransaksi} - ${o.name} @ (${o.lat}, ${o.lng}) ${kmFromGudang(o.lat, o.lng).toFixed(1)} km dari gudang, kurir id ${o.courierId}`);
  }
  console.log('Selesai.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});