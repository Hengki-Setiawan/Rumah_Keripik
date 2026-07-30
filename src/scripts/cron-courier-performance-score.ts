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

  const today = new Date().toISOString().slice(0, 10);

  const completed = await client.execute({
    sql: `SELECT da.id, da.kurir_id, da.delivered_at, da.proof_url, da.completion_lat, da.completion_lng,
        CAST(julianday(da.delivered_at) - julianday(da.started_at) AS REAL) * 1440 AS delivery_minutes
      FROM delivery_assignment da
      WHERE da.status = 'Terkirim' AND da.delivered_at IS NOT NULL AND da.started_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM courier_performance_daily cpd WHERE cpd.courier_id = da.kurir_id AND cpd.date = $today)`,
    args: { $today: today },
  });

  for (const row of completed.rows) {
    const courierId = row.kurir_id;
    const minutes = typeof row.delivery_minutes === 'number' ? row.delivery_minutes : 0;
    const onTime = minutes <= 60 ? 1 : 0;

    await client.execute({
      sql: `INSERT INTO courier_performance_daily (courier_id, date, total_assigned, total_completed, total_failed, on_time_rate, avg_delivery_minutes)
        VALUES ($cid, $date, 1, 1, 0, $ontime, $avg)
        ON CONFLICT(courier_id, date) DO UPDATE SET
          total_assigned = total_assigned + 1,
          total_completed = total_completed + 1,
          on_time_rate = (on_time_rate * (total_assigned - 1) + $ontime) / total_assigned,
          avg_delivery_minutes = (avg_delivery_minutes * (total_assigned - 1) + $avg) / total_assigned`,
      args: {
        $cid: courierId,
        $date: today,
        $ontime: onTime,
        $avg: minutes,
      },
    });
  }

  console.log(`Score worker: ${completed.rows.length} deliveries processed for ${today}.`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
