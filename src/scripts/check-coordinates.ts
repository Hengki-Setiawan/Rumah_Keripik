import { config } from 'dotenv';
config({ path: '.env.local' });

const TURSO_URL = process.env.TURSO_DATABASE_URL!.replace('libsql://', 'https://');
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN!;

async function execute(sql: string, args: unknown[] = []) {
  const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TURSO_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          type: 'execute',
          stmt: { sql, args: args.map((a) => (a === null ? { type: 'null' } : { type: 'text', value: String(a) })) },
        },
        { type: 'close' },
      ],
    }),
  });
  const data = await res.json();
  const r = data.results[0]?.response?.result;
  if (!r) return [];
  return r.rows.map((row: any) => Object.fromEntries(r.cols.map((col: any, i: number) => [col.name, row[i]?.value ?? row[i]])));
}

async function main() {
  const deliveries = await execute(`
    SELECT id_transaksi, lat_pengiriman, lng_pengiriman, alamat_penerima 
    FROM transaksi 
    WHERE order_status IN ('ready', 'confirmed', 'shipping', 'awaiting_admin_confirmation', 'Menunggu_Verifikasi')
  `);
  
  const grouped = new Map<string, number>();
  for (const d of deliveries) {
    const coord = `${d.lat_pengiriman},${d.lng_pengiriman}`;
    grouped.set(coord, (grouped.get(coord) || 0) + 1);
  }
  
  console.log(`Total pesanan: ${deliveries.length}`);
  console.log('Distribusi Koordinat:');
  for (const [coord, count] of grouped.entries()) {
    console.log(`- ${coord} : ${count} pesanan`);
  }
}

main().catch(console.error);
