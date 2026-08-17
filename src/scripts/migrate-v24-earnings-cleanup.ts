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

  // Kurir bersifat internal: "pendapatan" = total nilai penjualan yang diantar.
  // Hapus model earning rule / payroll period+slip yang tak pernah dipakai, dan
  // kolom legacy yang sudah tidak relevan (earning_type, payroll_period_id,
  // calculation_rule_id, paid_out_at). Rebuild tabel karena kolom ber-CONSTRAINT.
  // Catatan: DDL di Turso/libSQL auto-commit — jangan bungkus BEGIN/COMMIT.
  const existing = await client.execute(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='courier_earnings'`);
  if (existing.rows.length > 0) {
    const hasEarningType = await client.execute(`PRAGMA table_info(courier_earnings)`);
    const stillLegacy = hasEarningType.rows.some((r) => r.name === 'earning_type');
    if (stillLegacy) {
      await client.execute(`
        CREATE TABLE courier_earnings_new (
          id TEXT PRIMARY KEY,
          courier_id INTEGER NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
          delivery_assignment_id INTEGER REFERENCES delivery_assignment(id) ON DELETE SET NULL,
          order_id TEXT NOT NULL,
          base_fee INTEGER NOT NULL,
          bonus_amount INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed')),
          note TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
        )
      `);
      await client.execute(`
        INSERT INTO courier_earnings_new (id, courier_id, delivery_assignment_id, order_id, base_fee, bonus_amount, status, note, created_at)
        SELECT id, courier_id, delivery_assignment_id, order_id, base_fee, bonus_amount,
               CASE WHEN status IN ('pending','paid_out') THEN 'confirmed' ELSE status END,
               note, created_at
        FROM courier_earnings
      `);
      await client.execute(`DROP TABLE courier_earnings`);
      await client.execute(`ALTER TABLE courier_earnings_new RENAME TO courier_earnings`);
      await client.execute(`CREATE INDEX idx_courier_earnings_courier ON courier_earnings(courier_id, created_at)`);
      console.log('courier_earnings di-rebuild (kolom legacy dihapus, status -> confirmed).');
    } else {
      console.log('courier_earnings sudah bersih — dilewati.');
    }
  }

  for (const tbl of ['earning_rules', 'payroll_periods', 'payroll_slips']) {
    const t = await client.execute(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='${tbl}'`);
    if (t.rows.length > 0) {
      await client.execute(`DROP TABLE ${tbl}`);
      console.log(`DROP TABLE ${tbl} OK`);
    }
  }

  // Hapus kolom placeholder KPI yang tidak pernah terisi nilai nyata.
  const kpiCols = await client.execute(`PRAGMA table_info(courier_kpi_daily)`);
  const dropCols = ['total_rejected_offers', 'avg_delivery_minutes', 'total_distance_km', 'attendance_status'];
  for (const col of dropCols) {
    if (kpiCols.rows.some((r) => r.name === col)) {
      await client.execute(`ALTER TABLE courier_kpi_daily DROP COLUMN ${col}`);
      console.log(`DROP COLUMN courier_kpi_daily.${col} OK`);
    }
  }

  console.log('Migrasi v24 (cleanup earnings/payroll/kpi) selesai.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
