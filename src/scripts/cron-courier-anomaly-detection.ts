import fs from 'fs';
import path from 'path';
import { createClient } from '@libsql/client';

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index > 0) process.env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.TURSO_DATABASE_URL?.replace(/^libsql:\/\//, 'https://');
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error('TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN wajib ada.');
  const client = createClient({ url, authToken });

  const staleMinutes = parseInt(process.env.ANOMALY_STALE_MINUTES || '15', 10);
  const cutoff = new Date(Date.now() - staleMinutes * 60000).toISOString().replace('T', ' ').slice(0, 19);

  const staleDeliveries = await client.execute({
    sql: `SELECT da.id, da.id_transaksi, da.kurir_id, c.name AS kurir_name
      FROM delivery_assignment da
      JOIN couriers c ON c.id = da.kurir_id
      WHERE da.status = 'Dalam_Pengiriman'
      AND da.kurir_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM courier_locations cl
        WHERE cl.courier_id = da.kurir_id AND cl.received_at > $cutoff
      )`,
    args: { $cutoff: cutoff },
  });

  for (const row of staleDeliveries.rows) {
    await client.execute({
      sql: `INSERT INTO notifications (courier_id, title, body, type)
        VALUES ($cid, 'Peringatan Anomali', 'Tidak ada update lokasi selama ${staleMinutes} menit pada pengiriman ' || $tx || '. Harap periksa.', 'system')`,
      args: { $cid: row.kurir_id, $tx: row.id_transaksi },
    });
    console.log(`[ANOMALI] Courier ${row.kurir_name} (ID ${row.kurir_id}) — no location for ${staleMinutes}+ min on delivery ${row.id_transaksi}`);
  }

  const offRouteCutoff = new Date(Date.now() - 5 * 60000).toISOString().replace('T', ' ').slice(0, 19);

  console.log(`Anomaly check: ${staleDeliveries.rows.length} stale deliveries flagged.`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
