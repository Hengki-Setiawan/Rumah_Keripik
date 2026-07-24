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

  const statements = [
    `CREATE TABLE IF NOT EXISTS sos_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courier_id INTEGER NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
      courier_name TEXT,
      courier_phone TEXT,
      lat TEXT NOT NULL,
      lng TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','resolved')),
      resolved_at TEXT,
      resolved_by TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sos_events_status ON sos_events(status, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_sos_events_courier ON sos_events(courier_id, created_at)`,
  ];

  for (const sql of statements) {
    console.log(`  ${sql.slice(0, 70).replace(/\n/g, ' ')}...`);
    await client.execute(sql);
  }

  console.log('Migration v17 selesai: sos_events table created.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
