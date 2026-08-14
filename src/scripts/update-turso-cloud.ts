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
  console.log(' Meng-update Database Turso Real-Time Cloud agar 21 Pesanan Siap Kirim...');

  // Update status transaksi di Turso Cloud real-time
  await execute(`
    UPDATE transaksi 
    SET order_status = 'ready', updated_at = datetime('now') 
    WHERE order_status IN ('draft', 'Menunggu_Verifikasi', 'awaiting_admin_confirmation', 'confirmed') 
       OR kode_pesanan LIKE '%DEMO%'
  `);

  console.log(' Database Turso Cloud Real-Time berhasil diperbarui!');
}

main().catch(console.error);
