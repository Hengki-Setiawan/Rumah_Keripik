-- Migration 0003: Add couriers and courier sessions tables
-- Also adds kurir_id FK to delivery_assignment

CREATE TABLE IF NOT EXISTS couriers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  vehicle TEXT CHECK(vehicle IN ('motor', 'mobil')),
  plat_no TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_lat TEXT,
  last_lng TEXT,
  last_location_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE TABLE IF NOT EXISTS courier_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  courier_id INTEGER NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  last_active_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE INDEX IF NOT EXISTS idx_courier_sessions_courier ON courier_sessions(courier_id);

ALTER TABLE delivery_assignment ADD COLUMN kurir_id INTEGER REFERENCES couriers(id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignment_kurir ON delivery_assignment(kurir_id);
