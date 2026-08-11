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
  console.log('Mencari pesanan duplikat di tabel delivery_assignment...');
  
  // Ambil semua delivery hari ini
  const today = new Date().toISOString().split('T')[0];
  const allDeliveries = await execute(`SELECT id, id_transaksi FROM delivery_assignment WHERE DATE(created_at) = ?`, [today]);
  
  // Kelompokkan berdasarkan id_transaksi
  const grouped = new Map<string, any[]>();
  for (const d of allDeliveries) {
    if (d.id_transaksi) {
      const arr = grouped.get(d.id_transaksi) || [];
      arr.push(d);
      grouped.set(d.id_transaksi, arr);
    }
  }
  
  const toDeleteIds: number[] = [];
  
  for (const [id_transaksi, group] of grouped.entries()) {
    if (group.length > 1) {
      console.log(`Ditemukan duplikat untuk transaksi ${id_transaksi}: ${group.length} baris`);
      // Simpan yang pertama (id terkecil), hapus sisanya
      const sorted = group.sort((a, b) => Number(a.id) - Number(b.id));
      for (let i = 1; i < sorted.length; i++) {
        toDeleteIds.push(sorted[i].id);
      }
    }
  }
  
  if (toDeleteIds.length > 0) {
    console.log(`Menghapus ${toDeleteIds.length} baris duplikat...`);
    const placeholders = toDeleteIds.map(() => '?').join(',');
    await execute(`DELETE FROM delivery_assignment WHERE id IN (${placeholders})`, toDeleteIds);
    console.log('Berhasil dihapus.');
  } else {
    console.log('Tidak ada duplikat yang ditemukan.');
  }
}

main().catch(console.error);
