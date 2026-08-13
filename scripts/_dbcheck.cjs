const { createClient } = require('@libsql/client');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/TURSO_DATABASE_URL=(.*)/)[1].trim();
const token = env.match(/TURSO_AUTH_TOKEN=(.*)/)[1].trim();
const c = createClient({ url, authToken: token });

async function q(sql) {
  const r = await c.execute(sql);
  return r.rows;
}

(async () => {
  const total = await q('SELECT count(*) as n FROM transaksi');
  console.log('transaksi total:', total[0].n);

  const assign = await q(`SELECT d.kurir_id, d.status, count(*) as n
    FROM deliveryAssignment d GROUP BY d.kurir_id, d.status`);
  console.log('\ndeliveryAssignment by kurir_id/status:');
  assign.forEach((r) => console.log(' ', JSON.stringify(r)));

  const today = await q(`SELECT t.kode_pesanan, t.order_status, t.waktu_simpan,
    t.lat_pengiriman, t.lng_pengiriman, da.kurir_id
    FROM transaksi t LEFT JOIN deliveryAssignment da ON t.id_transaksi = da.id_transaksi
    WHERE t.waktu_simpan >= datetime('now', '-3 days')
    ORDER BY t.waktu_simpan DESC LIMIT 30`);
  console.log('\nRecent transactions (3 days):');
  today.forEach((r) => console.log(' ', JSON.stringify(r)));
})().catch((e) => console.error('ERR', e.message));
