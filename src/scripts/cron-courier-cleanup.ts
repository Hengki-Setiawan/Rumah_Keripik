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

  const cutoffDays = parseInt(process.env.LOCATION_RETENTION_DAYS || '60', 10);
  const cutoff = new Date(Date.now() - cutoffDays * 86400000).toISOString().replace('T', ' ').slice(0, 19);

  const result = await client.execute({
    sql: `DELETE FROM courier_locations WHERE received_at < $cutoff`,
    args: { $cutoff: cutoff },
  });

  const expiredShifts = await client.execute({
    sql: `SELECT id FROM shifts WHERE status = 'active' AND clock_in_at < $cutoff`,
    args: { $cutoff: new Date(Date.now() - 86400000).toISOString().replace('T', ' ').slice(0, 19) },
  });

  for (const row of expiredShifts.rows) {
    await client.execute({
      sql: `UPDATE shifts SET status = 'forced_end', clock_out_at = datetime('now', 'utc'), notes = 'Auto-ended by retention job' WHERE id = $id`,
      args: { $id: row.id },
    });
  }

  console.log(`Cleanup: ${result.rowsAffected} locations deleted, ${expiredShifts.rows.length} stale shifts ended.`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
