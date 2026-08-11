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
  // Step 1: tampilkan semua koordinat dan jumlahnya
  const coords = await execute(`
    SELECT lat_pengiriman, lng_pengiriman, COUNT(*) as n, GROUP_CONCAT(id_transaksi, ',') as ids
    FROM transaksi 
    WHERE order_status IN ('ready','confirmed','shipping','awaiting_admin_confirmation','Menunggu_Verifikasi')
    GROUP BY lat_pengiriman, lng_pengiriman
    ORDER BY CAST(n AS INTEGER) DESC
  `);
  
  console.log('=== Distribusi Koordinat ===');
  let totalToDelete = 0;
  const toDeleteIds: string[] = [];
  
  for (const c of coords) {
    const count = Number(c.n);
    const ids = String(c.ids).split(',');
    console.log(`lat=${c.lat_pengiriman} lng=${c.lng_pengiriman}: ${count} pesanan`);
    
    if (count > 1) {
      // Simpan yang pertama (id pertama), hapus sisanya
      const keep = ids[0];
      const toDelete = ids.slice(1);
      toDeleteIds.push(...toDelete);
      totalToDelete += toDelete.length;
      console.log(`  → Simpan: ${keep}, Hapus: ${toDelete.join(', ')}`);
    }
  }
  
  console.log(`\nTotal akan dihapus: ${totalToDelete} pesanan`);
  
  if (toDeleteIds.length === 0) {
    console.log('✅ Tidak ada duplikat koordinat.');
    return;
  }
  
  // Step 2: hapus delivery_assignment dulu (FK constraint)
  for (const id of toDeleteIds) {
    await execute(`DELETE FROM delivery_assignment WHERE id_transaksi = '${id}'`);
  }
  console.log('✅ delivery_assignment duplikat dihapus.');
  
  // Step 3: hapus transaksi duplikat
  for (const id of toDeleteIds) {
    await execute(`DELETE FROM transaksi WHERE id_transaksi = '${id}'`);
  }
  console.log(`✅ ${toDeleteIds.length} pesanan duplikat koordinat berhasil dihapus!`);
  
  // Step 4: report sisa
  const remaining = await execute(`SELECT COUNT(*) as n FROM transaksi WHERE order_status IN ('ready','confirmed','shipping','awaiting_admin_confirmation','Menunggu_Verifikasi')`);
  console.log(`\nSisa pesanan aktif: ${remaining[0]?.n}`);
}

main().catch(console.error);
