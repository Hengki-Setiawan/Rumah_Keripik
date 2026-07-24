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
    `CREATE TABLE IF NOT EXISTS courier_earnings (
      id TEXT PRIMARY KEY,
      courier_id INTEGER NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
      delivery_assignment_id INTEGER REFERENCES delivery_assignment(id) ON DELETE SET NULL,
      order_id TEXT NOT NULL,
      base_fee INTEGER NOT NULL,
      bonus_amount INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','paid_out')),
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      paid_out_at TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_courier_earnings_courier ON courier_earnings(courier_id, created_at)`,
    `CREATE TABLE IF NOT EXISTS tracking_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      event_type TEXT NOT NULL CHECK(event_type IN ('courier_location','status_change','eta_update','proof_uploaded')),
      lat TEXT,
      lng TEXT,
      eta_minutes INTEGER,
      status TEXT,
      metadata_json TEXT,
      courier_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_tracking_events_order ON tracking_events(order_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_tracking_events_courier ON tracking_events(courier_id, created_at)`,
    `ALTER TABLE ai_runs ADD COLUMN cost_estimate_usd INTEGER`,
    `CREATE TABLE IF NOT EXISTS ai_budget_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL UNIQUE,
      daily_budget_usd INTEGER NOT NULL DEFAULT 0,
      monthly_budget_usd INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      alert_threshold_percent INTEGER NOT NULL DEFAULT 80,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
  ];

  for (const statement of statements) await client.execute(statement);
  console.log('migrate-v16 (courier earnings, tracking events, AI budget) completed');
  client.close();
}

main().catch((e) => {
  console.error('migrate-v16 failed:', e);
  process.exit(1);
});
