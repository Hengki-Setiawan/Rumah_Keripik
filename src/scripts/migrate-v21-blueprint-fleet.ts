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

async function main() {
  loadEnvLocal();
  const url = process.env.TURSO_DATABASE_URL?.replace(/^libsql:\/\//, 'https://');
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error('TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN wajib ada.');
  const client = createClient({ url, authToken });

  const statements = [
    // ─── WAREHOUSE & GEOFENCE (blueprint VI.1) ──────────────────────────────
    `CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      lat TEXT NOT NULL,
      lng TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `INSERT INTO warehouses (name, address, lat, lng, is_active)
     SELECT 'Rumah Produksi Kaluku Bodoa', 'Kaluku Bodoa, Kec. Tallo, Kota Makassar, Sulawesi Selatan', '-5.105950', '119.432407', 1
     WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE id = 1)`,
    `CREATE TABLE IF NOT EXISTS geofence_zones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_id INTEGER REFERENCES warehouses(id),
      name TEXT NOT NULL,
      zone_type TEXT NOT NULL CHECK(zone_type IN ('attendance_radius','service_area','danger_zone','depot')),
      center_lat TEXT NOT NULL,
      center_lng TEXT NOT NULL,
      radius_meters INTEGER NOT NULL DEFAULT 150,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `INSERT INTO geofence_zones (warehouse_id, name, zone_type, center_lat, center_lng, radius_meters)
     SELECT 1, 'Radius Absensi Rumah Produksi', 'attendance_radius', '-5.105950', '119.432407', 150
     WHERE NOT EXISTS (SELECT 1 FROM geofence_zones WHERE zone_type = 'attendance_radius')`,
    `CREATE INDEX IF NOT EXISTS idx_geofence_warehouse ON geofence_zones(warehouse_id)`,

    // ─── SHIFT TEMPLATES / COURIER SHIFTS / ATTENDANCE (blueprint VI.2) ─────
    `CREATE TABLE IF NOT EXISTS shift_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `INSERT INTO shift_templates (name, start_time, end_time)
     SELECT 'Shift Pagi', '08:00', '16:00' WHERE NOT EXISTS (SELECT 1 FROM shift_templates WHERE name = 'Shift Pagi')`,
    `INSERT INTO shift_templates (name, start_time, end_time)
     SELECT 'Shift Siang', '12:00', '20:00' WHERE NOT EXISTS (SELECT 1 FROM shift_templates WHERE name = 'Shift Siang')`,
    `CREATE TABLE IF NOT EXISTS courier_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courier_id INTEGER NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
      shift_template_id INTEGER REFERENCES shift_templates(id),
      shift_date TEXT NOT NULL,
      planned_start TEXT NOT NULL,
      planned_end TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','confirmed','swapped','cancelled','completed','no_show')),
      swap_requested_to_courier_id INTEGER REFERENCES couriers(id),
      swap_approved_by TEXT,
      is_on_call INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_courier_shifts_courier_date ON courier_shifts(courier_id, shift_date)`,
    `CREATE INDEX IF NOT EXISTS idx_courier_shifts_date ON courier_shifts(shift_date)`,
    `CREATE TABLE IF NOT EXISTS courier_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courier_id INTEGER NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
      courier_shift_id INTEGER REFERENCES courier_shifts(id),
      clock_in_at TEXT,
      clock_in_lat TEXT,
      clock_in_lng TEXT,
      clock_in_within_geofence INTEGER,
      clock_in_selfie_url TEXT,
      clock_out_at TEXT,
      clock_out_lat TEXT,
      clock_out_lng TEXT,
      clock_out_within_geofence INTEGER,
      total_work_minutes INTEGER,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed','flagged_late','flagged_early_leave','flagged_no_geofence')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_attendance_courier ON courier_attendance(courier_id, clock_in_at)`,

    // ─── DELIVERY SUB-STATUS, POD & AUDIT (blueprint VI.3) ──────────────────
    `ALTER TABLE delivery_assignment ADD COLUMN sub_status TEXT`,
    `ALTER TABLE delivery_assignment ADD COLUMN offer_sent_at TEXT`,
    `ALTER TABLE delivery_assignment ADD COLUMN offer_expires_at TEXT`,
    `ALTER TABLE delivery_assignment ADD COLUMN offer_responded_at TEXT`,
    `ALTER TABLE delivery_assignment ADD COLUMN reject_reason TEXT`,
    `ALTER TABLE delivery_assignment ADD COLUMN requires_full_pod INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE delivery_assignment ADD COLUMN pod_verification_otp TEXT`,
    `ALTER TABLE delivery_assignment ADD COLUMN pod_verified_by_otp INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE delivery_assignment ADD COLUMN proof_photo_lat TEXT`,
    `ALTER TABLE delivery_assignment ADD COLUMN proof_photo_lng TEXT`,
    `ALTER TABLE delivery_assignment ADD COLUMN proof_photo_taken_at TEXT`,
    `ALTER TABLE delivery_assignment ADD COLUMN distance_planned_km TEXT`,
    `ALTER TABLE delivery_assignment ADD COLUMN distance_actual_km TEXT`,
    `ALTER TABLE delivery_assignment ADD COLUMN eta_at_assignment TEXT`,
    `ALTER TABLE delivery_assignment ADD COLUMN delayed_notification_sent INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE delivery_assignment ADD COLUMN warehouse_id INTEGER DEFAULT 1`,
    `CREATE INDEX IF NOT EXISTS idx_delivery_warehouse ON delivery_assignment(warehouse_id)`,
    `CREATE TABLE IF NOT EXISTS delivery_status_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_assignment_id INTEGER NOT NULL REFERENCES delivery_assignment(id) ON DELETE CASCADE,
      from_status TEXT,
      to_status TEXT NOT NULL,
      changed_by_type TEXT NOT NULL CHECK(changed_by_type IN ('courier','admin','system')),
      changed_by_id TEXT,
      lat TEXT,
      lng TEXT,
      device_id TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_delivery_audit_assignment ON delivery_status_audit(delivery_assignment_id, created_at)`,

    // ─── ROUTE OPTIMIZATION RUNS (blueprint VI.4) ───────────────────────────
    `CREATE TABLE IF NOT EXISTS route_optimization_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_date TEXT NOT NULL,
      courier_id INTEGER NOT NULL REFERENCES couriers(id),
      algorithm_version TEXT NOT NULL,
      stop_count INTEGER NOT NULL,
      estimated_distance_km TEXT,
      estimated_duration_minutes INTEGER,
      routing_engine_used TEXT,
      computed_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      computation_ms INTEGER,
      triggered_by TEXT NOT NULL CHECK(triggered_by IN ('cron_morning','admin_manual','courier_refresh','new_order_reoptimize'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_route_runs_courier_date ON route_optimization_runs(courier_id, route_date)`,
    `ALTER TABLE delivery_route_point ADD COLUMN route_optimization_run_id INTEGER REFERENCES route_optimization_runs(id)`,
    `ALTER TABLE delivery_route_point ADD COLUMN eta_minutes_from_prev INTEGER`,
    `ALTER TABLE delivery_route_point ADD COLUMN distance_km_from_prev TEXT`,
    `ALTER TABLE delivery_route_point ADD COLUMN visited_at TEXT`,

    // ─── VEHICLES & ASSETS (blueprint VI.5) ─────────────────────────────────
    `CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_id INTEGER REFERENCES warehouses(id) DEFAULT 1,
      plat_no TEXT NOT NULL UNIQUE,
      vehicle_type TEXT NOT NULL CHECK(vehicle_type IN ('motor','mobil')),
      brand_model TEXT,
      year INTEGER,
      capacity_kg REAL,
      capacity_volume_liter REAL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','maintenance','retired')),
      assigned_courier_id INTEGER REFERENCES couriers(id),
      odometer_km INTEGER,
      last_service_at TEXT,
      next_service_due_km INTEGER,
      insurance_expires_at TEXT,
      stnk_expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_vehicles_courier ON vehicles(assigned_courier_id)`,
    `CREATE TABLE IF NOT EXISTS vehicle_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      log_type TEXT NOT NULL CHECK(log_type IN ('bbm','servis','ganti_oli','ban','pajak','insiden','lainnya')),
      cost_amount INTEGER,
      odometer_km INTEGER,
      note TEXT,
      receipt_photo_url TEXT,
      logged_by_courier_id INTEGER REFERENCES couriers(id),
      logged_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_vehicle_logs_vehicle ON vehicle_logs(vehicle_id, logged_at)`,

    // ─── EARNING RULES & PAYROLL (blueprint VI.6) ───────────────────────────
    `ALTER TABLE courier_earnings ADD COLUMN payroll_period_id TEXT`,
    `ALTER TABLE courier_earnings ADD COLUMN earning_type TEXT NOT NULL DEFAULT 'per_delivery' CHECK(earning_type IN ('per_delivery','bonus_ontime','bonus_target_harian','penalti','lainnya'))`,
    `ALTER TABLE courier_earnings ADD COLUMN calculation_rule_id INTEGER`,
    `CREATE TABLE IF NOT EXISTS earning_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      rule_type TEXT NOT NULL CHECK(rule_type IN ('percentage_of_order','flat_per_delivery','flat_per_km','bonus_threshold')),
      percentage_value REAL,
      flat_value INTEGER,
      minimum_amount INTEGER,
      threshold_count INTEGER,
      threshold_bonus_amount INTEGER,
      vehicle_type_filter TEXT NOT NULL DEFAULT 'semua' CHECK(vehicle_type_filter IN ('motor','mobil','semua')),
      is_active INTEGER NOT NULL DEFAULT 1,
      effective_from TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      effective_until TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `INSERT INTO earning_rules (name, rule_type, percentage_value, minimum_amount, is_active)
     SELECT 'Aturan Standar (10% nilai barang, min Rp5.000)', 'percentage_of_order', 10.0, 5000, 1
     WHERE NOT EXISTS (SELECT 1 FROM earning_rules WHERE name = 'Aturan Standar (10% nilai barang, min Rp5.000)')`,
    `CREATE TABLE IF NOT EXISTS payroll_periods (
      id TEXT PRIMARY KEY,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','locked','paid')),
      locked_at TEXT,
      paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE TABLE IF NOT EXISTS payroll_slips (
      id TEXT PRIMARY KEY,
      payroll_period_id TEXT NOT NULL REFERENCES payroll_periods(id),
      courier_id INTEGER NOT NULL REFERENCES couriers(id),
      total_deliveries INTEGER NOT NULL DEFAULT 0,
      total_base_earnings INTEGER NOT NULL DEFAULT 0,
      total_bonus INTEGER NOT NULL DEFAULT 0,
      total_penalty INTEGER NOT NULL DEFAULT 0,
      total_net INTEGER NOT NULL DEFAULT 0,
      generated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      pdf_url TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_payroll_slips_courier ON payroll_slips(courier_id, payroll_period_id)`,

    // ─── SOS INCIDENTS TERSTRUKTUR (blueprint VI.7) ─────────────────────────
    `CREATE TABLE IF NOT EXISTS sos_incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courier_id INTEGER NOT NULL REFERENCES couriers(id),
      delivery_assignment_id INTEGER REFERENCES delivery_assignment(id),
      lat TEXT,
      lng TEXT,
      type TEXT,
      severity TEXT,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','acknowledged','resolved','false_alarm')),
      acknowledged_by TEXT,
      acknowledged_at TEXT,
      resolved_by TEXT,
      resolved_at TEXT,
      resolution_note TEXT,
      triggered_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sos_courier ON sos_incidents(courier_id, triggered_at)`,
    `CREATE INDEX IF NOT EXISTS idx_sos_status ON sos_incidents(status)`,

    // ─── NOTIFICATION LOG & DELIVERY RECEIPT (blueprint VI.8) ───────────────
    `CREATE TABLE IF NOT EXISTS notification_log (
      id TEXT PRIMARY KEY,
      recipient_type TEXT NOT NULL CHECK(recipient_type IN ('courier','customer','admin')),
      recipient_id TEXT NOT NULL,
      notification_type TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('critical','high','normal','low')),
      payload_json TEXT NOT NULL,
      expo_ticket_id TEXT,
      server_sent_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      device_received_at TEXT,
      device_opened_at TEXT,
      delivery_status TEXT NOT NULL DEFAULT 'sent' CHECK(delivery_status IN ('sent','device_confirmed','opened','failed','expired'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_notification_recipient ON notification_log(recipient_type, recipient_id, server_sent_at)`,
    `CREATE INDEX IF NOT EXISTS idx_notification_status ON notification_log(delivery_status)`,

    // ─── COURIER KPI DAILY (blueprint VI.9) ─────────────────────────────────
    `CREATE TABLE IF NOT EXISTS courier_kpi_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courier_id INTEGER NOT NULL REFERENCES couriers(id),
      kpi_date TEXT NOT NULL,
      total_assigned INTEGER NOT NULL DEFAULT 0,
      total_delivered INTEGER NOT NULL DEFAULT 0,
      total_failed INTEGER NOT NULL DEFAULT 0,
      total_rejected_offers INTEGER NOT NULL DEFAULT 0,
      on_time_rate REAL,
      avg_delivery_minutes REAL,
      total_distance_km REAL,
      total_earnings INTEGER NOT NULL DEFAULT 0,
      attendance_status TEXT,
      computed_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_kpi_courier_date ON courier_kpi_daily(courier_id, kpi_date)`,

    // ─── COURIER COLUMNS (employment_type, hired_at, warehouse_id) ──────────
    `ALTER TABLE couriers ADD COLUMN employment_type TEXT CHECK(employment_type IN ('tetap','paruh_waktu','harian')) DEFAULT 'tetap'`,
    `ALTER TABLE couriers ADD COLUMN hired_at TEXT`,
    `ALTER TABLE couriers ADD COLUMN warehouse_id INTEGER DEFAULT 1`,
    `CREATE INDEX IF NOT EXISTS idx_couriers_warehouse ON couriers(warehouse_id)`,
  ];

  for (const sql of statements) {
    try {
      console.log(`  ${sql.slice(0, 70).replace(/\n/g, ' ')}...`);
      await client.execute(sql);
    } catch (err) {
      const msg = String((err as Error).message || err);
      // ALTER yang sudah pernah dijalankan (duplicate column name) dianggap idempoten.
      if (msg.toLowerCase().includes('duplicate column name')) {
        console.log(`  (skip) kolom sudah ada`);
      } else {
        throw err;
      }
    }
  }

  console.log('Migration v21-v25 selesai: warehouses, geofence, shift/attendance, sub-status/POD, route runs, vehicles, payroll, sos_incidents, notification_log, courier_kpi_daily.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
