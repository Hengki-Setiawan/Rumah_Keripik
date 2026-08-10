/**
 * Script: Clean test data & assign 5 clean Makassar demo orders with valid coordinates to Budi
 */
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
  console.log('🧹 Membersihkan assignment lama Kurir Budi...');
  await execute('DELETE FROM delivery_assignment WHERE kurir_id = 1');

  console.log('📦 Memilih 5 pesanan demo Makassar yang memiliki koordinat LAT/LNG presisi...');
  
  // Ambil transaksi demo yang punya lat & lng presisi di Makassar
  const demoOrders = await execute(`
    SELECT id_transaksi, kode_pesanan, nama_penerima, alamat_penerima, lat_pengiriman, lng_pengiriman 
    FROM transaksi 
    WHERE lat_pengiriman IS NOT NULL 
      AND lng_pengiriman IS NOT NULL 
      AND nama_penerima NOT LIKE '%Smoke UI%' 
      AND nama_penerima NOT LIKE '%Tester%'
    LIMIT 6
  `);

  console.table(demoOrders);

  const today = new Date().toISOString().slice(0, 10);

  for (const o of demoOrders as any[]) {
    await execute(
      `INSERT INTO delivery_assignment 
       (id_transaksi, kurir_id, kurir_name, status, requires_full_pod, delayed_notification_sent, warehouse_id, created_at, updated_at)
       VALUES (?, 1, 'Budi', 'Siap_Dikirim', 0, 0, 1, datetime('now'), datetime('now'))`,
      [o.id_transaksi]
    );

    await execute(
      `UPDATE transaksi SET order_status = 'ready', updated_at = datetime('now') WHERE id_transaksi = ?`,
      [o.id_transaksi]
    );

    console.log(`✅ Assigned to Budi: ${o.kode_pesanan} (${o.nama_penerima}) — Lat: ${o.lat_pengiriman}, Lng: ${o.lng_pengiriman}`);
  }

  console.log('\n🎉 Data pesanan Kurir Budi berhasil diperbarui!');
}

main().catch(console.error);
