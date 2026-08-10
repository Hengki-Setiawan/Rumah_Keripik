import { config } from 'dotenv';
config({ path: '.env.local' });

const TURSO_URL = process.env.TURSO_DATABASE_URL!.replace('libsql://', 'https://');
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN!;

async function execute(sql: string) {
  const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TURSO_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql } }, { type: 'close' }] }),
  });
  const data = await res.json();
  const r = data.results[0]?.response?.result;
  if (!r) return [];
  return r.rows.map((row: any) => Object.fromEntries(r.cols.map((col: any, i: number) => [col.name, row[i]?.value ?? row[i]])));
}

async function main() {
  console.log('\n=== CEK SEMUA PESANAN SIAP KIRIM (AUTOMATIC FOR ALL COURIERS) ===');
  const rows = await execute(`
    SELECT t.id_transaksi, t.kode_pesanan, t.nama_penerima, t.order_status, da.kurir_id
    FROM transaksi t
    LEFT JOIN delivery_assignment da ON t.id_transaksi = da.id_transaksi
    WHERE t.order_status IN ('ready', 'confirmed', 'shipping', 'awaiting_admin_confirmation', 'Menunggu_Verifikasi')
  `);
  console.table(rows);
}

main();
