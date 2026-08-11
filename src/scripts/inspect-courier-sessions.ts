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
  console.log('\n=== SEMUA KURIR DI DATABASE ===');
  const couriers = await execute('SELECT id, name, phone, pin_hash, is_active FROM couriers');
  console.table(couriers);

  console.log('\n=== SEMUA ASSIGNMENT DENGAN NAMA KURIR ===');
  const assignments = await execute('SELECT da.id, da.kurir_id, da.id_transaksi, da.status, c.name as nama_kurir FROM delivery_assignment da LEFT JOIN couriers c ON da.kurir_id = c.id');
  console.table(assignments);
}

main();
