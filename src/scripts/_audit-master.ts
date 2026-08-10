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
  const txt = await r.text();
  let d;
  try { d = JSON.parse(txt); } catch { return { error: 'JSON parse fail', raw: txt.slice(0, 300) }; }
  const res = d.results?.[0]?.response?.result;
  if (!res) return { error: 'no result', full: JSON.stringify(d).slice(0, 400) };
  return {
    rows: res.rows.map((row: any) => Object.fromEntries(res.cols.map((c: any, i: number) => [c.name, row[i]?.value ?? row[i]]))),
  };
}

async function main() {
  const out: Record<string, any> = {};

  out.stats = await q(`SELECT order_status, count(*) n FROM transaksi GROUP BY order_status ORDER BY n DESC`);
  out.methods = await q(`SELECT id_payment_method, label, type, is_active FROM payment_method WHERE is_active=1`);
  out.couriers = await q(`SELECT id, name, phone, is_active, warehouse_id FROM couriers`);
  out.warehouses = await q(`SELECT id, name, lat, lng, is_active FROM warehouses`);
  out.varian = await q(`SELECT id_varian, id_produk, nama_varian, harga_jual, stok, is_active FROM produk_varian WHERE is_active=1`);

  const countTables = ['detail_transaksi','delivery_assignment','delivery_route_point','order_status_history','order_events','payment_intent','lokasi_pelanggan','pelanggan_chatbot','customer_profile','customer_address','web_order_session','order_draft','tracking_events','buykr_events','delivery_events','notifications','courier_earnings'];
  out.counts = {};
  for (const t of countTables) {
    const r = await q(`SELECT count(*) n FROM ${t}`);
    out.counts[t] = r.rows?.[0]?.n ?? r.error ?? r.full;
  }

  console.log(JSON.stringify(out, null, 1));
}

main().catch(console.error);