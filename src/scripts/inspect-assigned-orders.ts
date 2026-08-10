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
  console.log('\n=== 8 PESANAN YANG DI-ASSIGN KE BUDI ===');
  const rows = await execute(`
    SELECT 
      da.id as delivery_id,
      t.id_transaksi,
      t.kode_pesanan,
      t.nama_penerima,
      t.alamat_penerima,
      t.lat_pengiriman,
      t.lng_pengiriman,
      t.payment_method
    FROM delivery_assignment da
    JOIN transaksi t ON da.id_transaksi = t.id_transaksi
    WHERE da.kurir_id = 1
  `);
  console.table(rows);
}

main();
