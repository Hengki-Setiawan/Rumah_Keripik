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
    // Add employee_code to existing couriers
    `ALTER TABLE couriers ADD COLUMN employee_code TEXT`,
    `CREATE INDEX IF NOT EXISTS idx_couriers_employee_code ON couriers(employee_code)`,

    // shifts table
    `CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courier_id INTEGER NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
      clock_in_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      clock_out_at TEXT,
      clock_in_lat TEXT,
      clock_in_lng TEXT,
      clock_out_lat TEXT,
      clock_out_lng TEXT,
      total_deliveries INTEGER DEFAULT 0,
      total_distance_km REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','ended','forced_end')),
      notes TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_shifts_courier ON shifts(courier_id, clock_in_at)`,
    `CREATE INDEX IF NOT EXISTS idx_shifts_active ON shifts(courier_id, status)`,

    // delivery_events table (audit trail)
    `CREATE TABLE IF NOT EXISTS delivery_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_id INTEGER NOT NULL REFERENCES delivery_assignment(id) ON DELETE CASCADE,
      courier_id INTEGER REFERENCES couriers(id),
      event_type TEXT NOT NULL CHECK(event_type IN ('assigned','started','arrived','completed','failed','reassigned','cancelled','note_added')),
      lat TEXT,
      lng TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_delivery_events_delivery ON delivery_events(delivery_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_delivery_events_courier ON delivery_events(courier_id, created_at)`,

    // notifications table (in-app inbox)
    `CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courier_id INTEGER REFERENCES couriers(id),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('new_delivery','reassignment','broadcast','shift_reminder','performance','system')),
      is_read INTEGER NOT NULL DEFAULT 0,
      related_delivery_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_courier ON notifications(courier_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(courier_id, is_read)`,

    // courier_performance_daily table
    `CREATE TABLE IF NOT EXISTS courier_performance_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courier_id INTEGER NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      total_assigned INTEGER DEFAULT 0,
      total_completed INTEGER DEFAULT 0,
      total_failed INTEGER DEFAULT 0,
      on_time_rate REAL,
      avg_delivery_minutes REAL,
      total_distance_km REAL DEFAULT 0,
      total_cod_collected_amount INTEGER DEFAULT 0,
      incident_count INTEGER DEFAULT 0,
      score REAL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_perf_courier_date ON courier_performance_daily(courier_id, date)`,
    `CREATE INDEX IF NOT EXISTS idx_perf_date ON courier_performance_daily(date)`,
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

  console.log('Migration v20 selesai: shifts, delivery_events, notifications, courier_performance_daily.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
