const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const state = JSON.parse(fs.readFileSync('e2e-run-state.json', 'utf8'));

const rawUrl = process.env.TURSO_DATABASE_URL || '';
const dbUrl = rawUrl.replace(/^libsql:\/\//, 'https://').replace(/\/$/, '');
const token = process.env.TURSO_AUTH_TOKEN || process.env.TURSO_DATABASE_AUTH_TOKEN || '';

async function query(sql) {
  const res = await fetch(`${dbUrl}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql } }, { type: 'close' }] })
  });
  const json = await res.json();
  const step = json?.results?.[0];
  const result = step?.response?.result;
  if (!result) return [];
  const cols = (result.cols || []).map(c => c.name);
  return (result.rows || []).map(row => {
    const obj = {};
    cols.forEach((col, i) => { obj[col] = row[i]?.value ?? null; });
    return obj;
  });
}

async function verify() {
  console.log('=== VERIFIKASI TURSO DB UNTUK', state.kode_pesanan, '===');
  const tx = await query(`SELECT id_transaksi, kode_pesanan, order_status, payment_status, status_pembayaran, total_bayar FROM transaksi WHERE kode_pesanan = '${state.kode_pesanan}'`);
  console.log('1. Status Transaksi:', tx);

  const assign = await query(`SELECT id, id_transaksi, kurir_id, kurir_name, status FROM delivery_assignment WHERE id_transaksi = '${state.id_transaksi}'`);
  console.log('2. Status Penugasan Kurir:', assign);

  const history = await query(`SELECT event_type, order_status, payment_status, actor FROM order_status_history WHERE id_transaksi = '${state.id_transaksi}' ORDER BY id`);
  console.log('3. Riwayat Order History:', history);

  const prod = await query(`SELECT id_produk, nama_produk, stok_gudang_utama FROM produk WHERE id_produk = '${state.product_id}'`);
  console.log('4. Stok Produk Terkini:', prod);
}

verify().catch(console.error);
