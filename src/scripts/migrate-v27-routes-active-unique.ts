import fs from 'fs';
import path from 'path';
import { createClient } from '@libsql/client/web';

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

async function indexExists(client: Awaited<ReturnType<typeof createClient>>, name: string): Promise<boolean> {
  const res = await client.execute(`SELECT 1 FROM sqlite_master WHERE type='index' AND name='${name}'`);
  return res.rows.length > 0;
}

async function main() {
  loadEnvLocal();
  const url = process.env.TURSO_DATABASE_URL?.replace(/^libsql:\/\//, 'https://');
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error('TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN wajib ada.');
  const client = createClient({ url, authToken });

  if (!(await indexExists(client, 'uniq_routes_active_courier_date'))) {
    // Safety: kalau ada kurir dengan >1 jalur claimed/in_progress pada tanggal
    // sama, index parsial gagal dibuat. Release yang lebih lama dulu (kembalikan
    // ke open) supaya invariant "1 jalur aktif per kurir" terpenuhi.
    const dup = await client.execute(`
      SELECT courier_id, route_date, COUNT(*) AS cnt
      FROM delivery_routes
      WHERE status IN ('claimed','in_progress')
      GROUP BY courier_id, route_date
      HAVING COUNT(*) > 1
    `);
    if (dup.rows.length > 0) {
      console.log(`Menemukan ${dup.rows.length} grup kurir dgn >1 jalur aktif — melepas jalur ber-id lebih besar...`);
      for (const row of dup.rows) {
        const courierId = Number(row.courier_id);
        const routeDate = String(row.route_date);
        const extra = await client.execute({
          sql: `SELECT id FROM delivery_routes
           WHERE courier_id = ? AND route_date = ? AND status IN ('claimed','in_progress')
           ORDER BY id ASC`,
          args: [courierId, routeDate],
        });
        for (const r of extra.rows.slice(1)) {
          await client.execute({
            sql: `UPDATE delivery_routes SET courier_id = NULL, status = 'open', updated_at = datetime('now','utc') WHERE id = ?`,
            args: [Number(r.id)],
          });
          console.log(`  → Jalur #${Number(r.id)} (kurir ${courierId}, ${routeDate}) dilepas ke open.`);
        }
      }
    }
    await client.execute(`
      CREATE UNIQUE INDEX uniq_routes_active_courier_date
      ON delivery_routes(courier_id, route_date)
      WHERE status IN ('claimed','in_progress')
    `);
    console.log('Partial unique index uniq_routes_active_courier_date dibuat.');
  } else {
    console.log('uniq_routes_active_courier_date sudah ada — dilewati.');
  }

  console.log('Migrasi v27 (jalur aktif unik per kurir per tanggal) selesai.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
