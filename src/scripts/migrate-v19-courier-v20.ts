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
    // ─── SHIFTS ────────────────────────────────────────────────────────────────
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

    // ─── DELIVERY EVENTS (AUDIT TRAIL) ─────────────────────────────────────────
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

    // ─── NOTIFICATIONS INBOX ───────────────────────────────────────────────────
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

    // ─── PERFORMANCE DAILY ─────────────────────────────────────────────────────
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

    // ─── LOCATION TRACKING ─────────────────────────────────────────────────────
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
  ];

  for (const sql of statements) {
    console.log(`  ${sql.slice(0, 70).replace(/\n/g, ' ')}...`);
    await client.execute(sql);
  }

  console.log('Migration v19 selesai: courier v20 tables (shifts, delivery_events, notifications, courier_performance_daily, courier_locations) created.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
