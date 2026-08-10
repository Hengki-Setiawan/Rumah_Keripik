import { config } from 'dotenv';
config({ path: '.env.local' });

const URL = (process.env.TURSO_DATABASE_URL || '').replace('libsql://', 'https://');
const TOK = process.env.TURSO_AUTH_TOKEN || '';

async function q(sql: string) {
  const r = await fetch(URL + '/v2/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOK, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql } }, { type: 'close' }] }),
  });
  const d = await r.json();
  const res = d.results?.[0]?.response?.result;
  if (!res) return [];
  return res.rows.map((row: any) =>
    Object.fromEntries(res.cols.map((c: any, i: number) => [c.name, row[i]?.value ?? row[i]])),
  );
}

async function main() {
  const rows = await q(`SELECT
  t.kode_pesanan, t.id_transaksi, t.order_status,
  COALESCE(t.nama_penerima, t.nama_pemesan, '') as nm,
  COALESCE(t.alamat_penerima, t.alamat, '') as al,
  t.lat_pengiriman, t.lng_pengiriman,
  COALESCE(da.status, 'NO_ASSIGN') as asg, da.kurir_id
  FROM transaksi t
  LEFT JOIN deliveryAssignment da ON da.id_transaksi = t.id_transaksi
  WHERE t.order_status IN ('ready','confirmed','shipping','awaiting_admin_confirmation','Menunggu_Verifikasi')
  ORDER BY t.waktu_simpan`);

console.log('=== AKTIF', rows.length, '===');
rows.forEach((r: any) => {
  const nm = String(r.nm ?? '').slice(0, 18).padEnd(19);
  const al = String(r.al ?? '').slice(0, 34).padEnd(35);
  console.log(
    [String(r.kode_pesanan).padEnd(16), String(r.order_status).slice(0, 11).padEnd(12), nm, al, String(r.asg).padEnd(14), r.lat_pengiriman ?? '-'].join(' '),
  );
});
}

main().catch(console.error);