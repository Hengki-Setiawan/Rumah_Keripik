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
    // courier_locations table (GPS breadcrumb trail)
    `CREATE TABLE IF NOT EXISTS courier_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courier_id INTEGER NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
      lat TEXT NOT NULL,
      lng TEXT NOT NULL,
      accuracy REAL,
      speed REAL,
      heading REAL,
      battery_level REAL,
      recorded_at TEXT NOT NULL,
      received_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      delivery_id INTEGER REFERENCES delivery_assignment(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_courier_locations_time ON courier_locations(courier_id, recorded_at)`,
    `CREATE INDEX IF NOT EXISTS idx_courier_locations_delivery ON courier_locations(delivery_id, recorded_at)`,
    `CREATE INDEX IF NOT EXISTS idx_courier_locations_received ON courier_locations(received_at)`,

    // courier_earnings table (per-delivery tracking)
    `CREATE TABLE IF NOT EXISTS courier_earnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courier_id INTEGER NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
      delivery_id INTEGER NOT NULL REFERENCES delivery_assignment(id) ON DELETE CASCADE,
      base_fee INTEGER NOT NULL DEFAULT 0,
      bonus_amount INTEGER DEFAULT 0,
      cod_amount INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','paid_out')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_earnings_courier ON courier_earnings(courier_id, created_at)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_earnings_delivery ON courier_earnings(delivery_id)`,
    `CREATE INDEX IF NOT EXISTS idx_earnings_status ON courier_earnings(status)`,

    // Add new columns to delivery_assignment for courier workflow
    `ALTER TABLE delivery_assignment ADD COLUMN started_at TEXT`,
    `ALTER TABLE delivery_assignment ADD COLUMN arrived_at TEXT`,
    `ALTER TABLE delivery_assignment ADD COLUMN completion_lat TEXT`,
    `ALTER TABLE delivery_assignment ADD COLUMN completion_lng TEXT`,
    `ALTER TABLE delivery_assignment ADD COLUMN failure_reason TEXT`,
    `ALTER TABLE delivery_assignment ADD COLUMN recipient_phone TEXT`,
    `ALTER TABLE delivery_assignment ADD COLUMN sequence_in_route INTEGER DEFAULT 0`,
  ];

  for (const sql of statements) {
    console.log(`  ${sql.slice(0, 80).replace(/\n/g, ' ')}...`);
    try {
      await client.execute(sql);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('duplicate column')) throw err;
      console.log(`  (skipped: ${msg.slice(0, 60)})`);
    }
  }

  console.log('Migration v21 selesai: courier_locations, courier_earnings, kolom baru delivery_assignment.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
