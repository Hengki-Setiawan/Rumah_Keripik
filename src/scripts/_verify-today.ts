import { config } from 'dotenv';
config({ path: '.env.local' });
const URL = (process.env.TURSO_DATABASE_URL || '').replace('libsql://', 'https://');
const TOK = process.env.TURSO_AUTH_TOKEN || '';
async function q0(sql: string) {
  const r = await fetch(URL + '/v2/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOK, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql } }, { type: 'close' }] }),
  });
  const d = await r.json();
  const res = d.results?.[0]?.response?.result;
  if (!res) return { rows: [] };
  return { rows: res.rows.map((row: any) => Object.fromEntries(res.cols.map((c: any, i: number) => [c.name, row[i]?.value ?? row[i]]))) };
}
async function main() {
  const G = { lat: -5.134, lng: 119.4135 };
  const hav = (a: number, b: number, c: number, e: number) => {
    const R = 6371, dLat = ((c - a) * Math.PI) / 180, dLng = ((e - b) * Math.PI) / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos((a * Math.PI) / 180) * Math.cos((c * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  };
  const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const { rows } = await q0(`SELECT
      t.kode_pesanan, t.nama_penerima, t.lat_pengiriman, t.lng_pengiriman,
      da.status asg, da.kurir_id, drp.sequence_no
      FROM transaksi t
      LEFT JOIN delivery_assignment da ON da.id_transaksi = t.id_transaksi
      LEFT JOIN delivery_route_point drp ON drp.id_transaksi = t.id_transaksi AND drp.route_date = '${today}'
      WHERE t.order_status IN ('ready','confirmed','shipping','awaiting_admin_confirmation','Menunggu_Verifikasi')`);

  for (const courierId of [0, 1, 2]) {
    const filtered = rows.filter((r: any) => {
      if (!r.lat_pengiriman || !r.lng_pengiriman) return false;
      const la = Number(r.lat_pengiriman), ln = Number(r.lng_pengiriman);
      if (!Number.isFinite(la) || !Number.isFinite(ln)) return false;
      if (hav(la, ln, G.lat, G.lng) > 60) return false;
      if (courierId === 0) return true;
      return Number(r.kurir_id) === courierId;
    });
    console.log(`\n=== kurir id ${courierId}: ${filtered.length} pengiriman hari ini ===`);
    filtered.forEach((r: any) => {
      const km = hav(Number(r.lat_pengiriman), Number(r.lng_pengiriman), G.lat, G.lng);
      console.log(`  #${r.sequence_no ?? '-'} ${r.kode_pesanan} ${r.nama_penerima} @ (${r.lat_pengiriman}, ${r.lng_pengiriman}) ${km.toFixed(1)}km asg=${r.asg}`);
    });
  }
}
main().catch(console.error);