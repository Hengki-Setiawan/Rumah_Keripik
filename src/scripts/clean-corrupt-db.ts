import { config } from 'dotenv';
config({ path: '.env.local' });

const TURSO_URL = process.env.TURSO_DATABASE_URL!.replace('libsql://', 'https://');
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN!;

async function execute(sql: string) {
  const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TURSO_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{ type: 'execute', stmt: { sql } }, { type: 'close' }],
    }),
  });
  const data = await res.json();
  const r = data.results[0]?.response?.result;
  if (!r) return [];
  return r.rows.map((row: any) => Object.fromEntries(r.cols.map((col: any, i: number) => [col.name, row[i]?.value ?? row[i]])));
}

async function main() {
  // Check how many corrupt rows remain
  const countRows = await execute(`SELECT id_transaksi, lat_pengiriman, lng_pengiriman FROM transaksi WHERE lat_pengiriman LIKE '%object%' OR lng_pengiriman LIKE '%object%'`);
  console.log(`Ditemukan ${countRows.length} pesanan korup:`);
  for (const r of countRows) {
    console.log(`  - ${r.id_transaksi}: lat="${r.lat_pengiriman}" lng="${r.lng_pengiriman}"`);
  }

  if (countRows.length === 0) {
    console.log('✅ Tidak ada pesanan korup.');
    return;
  }

  // Delete them
  const deleteResult = await execute(`DELETE FROM transaksi WHERE lat_pengiriman LIKE '%object%' OR lng_pengiriman LIKE '%object%'`);
  console.log('✅ Berhasil menghapus pesanan korup. Result:', JSON.stringify(deleteResult));
  
  // Also delete orphaned delivery_assignments
  await execute(`DELETE FROM delivery_assignment WHERE id_transaksi NOT IN (SELECT id_transaksi FROM transaksi)`);
  console.log('✅ Delivery assignments yatim piatu juga dibersihkan.');
}

main().catch(console.error);
