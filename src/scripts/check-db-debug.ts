import { config } from 'dotenv';
config({ path: '.env.local' });

const TURSO_URL = process.env.TURSO_DATABASE_URL!;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN!;

// Use Turso HTTP API directly instead of native libsql client
async function query(sql: string, args: unknown[] = []) {
  const httpUrl = TURSO_URL.replace('libsql://', 'https://');
  const res = await fetch(`${httpUrl}/v2/pipeline`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TURSO_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        { type: 'execute', stmt: { sql, args: args.map(a => ({ type: 'text', value: String(a) })) } },
        { type: 'close' }
      ]
    }),
  });
  const data = await res.json() as { results: Array<{ response?: { result?: { rows: unknown[][], cols: Array<{name: string}> } } }> };
  const result = data.results[0]?.response?.result;
  if (!result) return [];
  return result.rows.map(row => 
    Object.fromEntries(result.cols.map((col, i) => [col.name, row[i]]))
  );
}

async function main() {
  console.log('\n===  DELIVERY ASSIGNMENTS (last 20) ===');
  const da = await query('SELECT id, kurir_id, id_transaksi, status, created_at FROM delivery_assignment ORDER BY created_at DESC LIMIT 20');
  if (da.length === 0) console.log(' KOSONG — Tidak ada delivery assignment sama sekali!');
  else console.table(da);

  console.log('\n===  TRANSAKSI (last 20) ===');
  const tx = await query('SELECT id_transaksi, kode_pesanan, order_status, status_pembayaran, waktu_simpan FROM transaksi ORDER BY waktu_simpan DESC LIMIT 20');
  if (tx.length === 0) console.log(' KOSONG — Tidak ada transaksi sama sekali!');
  else console.table(tx);

  console.log('\n=== ️ COURIERS ===');
  const couriers = await query('SELECT id, nama, phone, is_active FROM couriers LIMIT 20');
  if (couriers.length === 0) console.log(' KOSONG — Tidak ada data kurir!');
  else console.table(couriers);

  console.log('\n=== ⏳ TRANSAKSI siap dispatch (ready/confirmed/awaiting) ===');
  const ready = await query("SELECT id_transaksi, kode_pesanan, order_status, status_pembayaran FROM transaksi WHERE order_status IN ('ready','confirmed','awaiting_admin_confirmation','Menunggu_Verifikasi') LIMIT 20");
  if (ready.length === 0) console.log(' Tidak ada pesanan yang menunggu dispatch!');
  else console.table(ready);
}

main().catch(console.error);
