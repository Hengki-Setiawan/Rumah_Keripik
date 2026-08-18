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

async function runWithRetry(client: Awaited<ReturnType<typeof createClient>>, sql: string, attempts = 5) {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await client.execute(sql);
    } catch (error) {
      lastError = error;
      if (i < attempts) await new Promise((r) => setTimeout(r, 800 * i));
    }
  }
  throw lastError;
}

// v29: sinkronkan skema live dengan schema.ts.
// 1) stock_watch: tabel ada di live & schema.ts tapi tidak ada di migrasi manapun.
// 2) payment_proof & payment_ocr_result: orphan (tidak ada di schema.ts), kosong di live -> dihapus.
// 3) Index duplikat: idx_kpi_courier_date (redundan, idx_kpi_courier_date_unique sudah ada)
//    dan idx_expo_push_token (redundan, kolom token sudah UNIQUE inline).
// 4) delivery_events: CHECK enum lama menolak 'notify_arriving'/'notify_arrived' -> rebuild tabel.
// 5) Index untuk semua kolom FK tanpa index (hasil introspection live).
// Semua idempotent: aman dijalankan ulang.

const stockWatchStatements = [
  `CREATE TABLE IF NOT EXISTS stock_watch (
  id text PRIMARY KEY,
  chat_session_id text NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  id_produk text NOT NULL REFERENCES produk(id_produk),
  id_varian text REFERENCES produk_varian(id_varian),
  status text NOT NULL DEFAULT 'watching',
  created_at text NOT NULL DEFAULT (datetime('now', 'utc')),
  notified_at text
)`,
  `CREATE INDEX IF NOT EXISTS idx_stock_watch_session ON stock_watch(chat_session_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_stock_watch_produk ON stock_watch(id_produk, status)`,
  `CREATE INDEX IF NOT EXISTS idx_stock_watch_varian ON stock_watch(id_varian)`,
];

const dropDuplicateIndexes = [
  `DROP INDEX IF EXISTS idx_kpi_courier_date`,
  `DROP INDEX IF EXISTS idx_expo_push_token`,
];

const fkIndexStatements = [
  `CREATE INDEX IF NOT EXISTS idx_bukti_pembayaran_transaksi ON bukti_pembayaran(id_transaksi)`,
  `CREATE INDEX IF NOT EXISTS idx_chat_cart_items_variant ON chat_cart_items(variant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_chat_cart_items_product ON chat_cart_items(product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_courier_attendance_shift ON courier_attendance(courier_shift_id)`,
  `CREATE INDEX IF NOT EXISTS idx_courier_earnings_assignment ON courier_earnings(delivery_assignment_id)`,
  `CREATE INDEX IF NOT EXISTS idx_courier_shifts_swap_to ON courier_shifts(swap_requested_to_courier_id)`,
  `CREATE INDEX IF NOT EXISTS idx_courier_shifts_template ON courier_shifts(shift_template_id)`,
  `CREATE INDEX IF NOT EXISTS idx_delivery_assignment_route ON delivery_assignment(route_id)`,
  `CREATE INDEX IF NOT EXISTS idx_delivery_route_point_optimization ON delivery_route_point(route_optimization_run_id)`,
  `CREATE INDEX IF NOT EXISTS idx_delivery_routes_warehouse ON delivery_routes(warehouse_id)`,
  `CREATE INDEX IF NOT EXISTS idx_detail_transaksi_produk ON detail_transaksi(id_produk)`,
  `CREATE INDEX IF NOT EXISTS idx_detail_transaksi_transaksi ON detail_transaksi(id_transaksi)`,
  `CREATE INDEX IF NOT EXISTS idx_device_identity_links_customer ON device_identity_links(customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_lokasi_pelanggan_no_wa ON lokasi_pelanggan(no_wa_pelanggan)`,
  `CREATE INDEX IF NOT EXISTS idx_oauth_links_customer ON oauth_links(customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_payment_intent_method ON payment_intent(id_payment_method)`,
  `CREATE INDEX IF NOT EXISTS idx_recommendation_events_product ON recommendation_events(selected_product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sos_incidents_assignment ON sos_incidents(delivery_assignment_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transaksi_no_wa ON transaksi(no_wa_pelanggan)`,
  `CREATE INDEX IF NOT EXISTS idx_vehicle_logs_courier ON vehicle_logs(logged_by_courier_id)`,
  `CREATE INDEX IF NOT EXISTS idx_vehicles_warehouse ON vehicles(warehouse_id)`,
  `CREATE INDEX IF NOT EXISTS idx_waitlist_produk_produk ON waitlist_produk(id_produk)`,
  `CREATE INDEX IF NOT EXISTS idx_waitlist_produk_no_wa ON waitlist_produk(no_wa_pelanggan)`,
];

const ORPHAN_TABLES = ['payment_proof', 'payment_ocr_result'];

async function main() {
  loadEnvLocal();
  const url = process.env.TURSO_DATABASE_URL?.replace(/^libsql:\/\//, 'https://');
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error('TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN wajib ada.');
  const client = createClient({ url, authToken });

  let created = 0;
  let errors = 0;

  for (const statement of stockWatchStatements) {
    try {
      await runWithRetry(client, statement);
      created += 1;
    } catch (error) {
      errors += 1;
      console.error(`ERROR stock_watch:\n  ${statement}\n  ${(error as Error).message}`);
    }
  }

  for (const table of ORPHAN_TABLES) {
    try {
      const existsRes = await runWithRetry(client, `SELECT 1 FROM sqlite_master WHERE type='table' AND name='${table}'`);
      if (existsRes.rows.length === 0) {
        console.log(`skip drop orphan ${table}: tabel tidak ada`);
        continue;
      }
      const countRes = await runWithRetry(client, `SELECT COUNT(*) AS c FROM ${table}`);
      const count = Number(countRes.rows[0]?.c || 0);
      if (count > 0) {
        console.warn(`SKIP drop ${table}: berisi ${count} baris (orphan tapi tidak kosong)`);
        continue;
      }
      await runWithRetry(client, `DROP TABLE IF EXISTS ${table}`);
      console.log(`dropped orphan table: ${table}`);
    } catch (error) {
      errors += 1;
      console.error(`ERROR drop orphan ${table}: ${(error as Error).message}`);
    }
  }

  for (const statement of dropDuplicateIndexes) {
    try {
      await runWithRetry(client, statement);
      created += 1;
    } catch (error) {
      errors += 1;
      console.error(`ERROR drop index:\n  ${statement}\n  ${(error as Error).message}`);
    }
  }

  try {
    const tableSql = await runWithRetry(client, `SELECT sql FROM sqlite_master WHERE type='table' AND name='delivery_events'`);
    const currentSql = String(tableSql.rows[0]?.sql || '');
    if (!currentSql.includes('notify_arriving')) {
      // HTTP API libsql bersifat stateless: BEGIN/COMMIT lintas request TIDAK transaksional.
      // Pakai batch agar seluruh langkah rebuild dieksekusi atomik dalam satu request.
      await client.batch([
        `CREATE TABLE delivery_events_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_id INTEGER NOT NULL REFERENCES delivery_assignment(id) ON DELETE CASCADE,
  courier_id INTEGER REFERENCES couriers(id),
  event_type TEXT NOT NULL CHECK(event_type IN ('assigned','started','arrived','completed','failed','reassigned','cancelled','note_added','notify_arriving','notify_arrived')),
  lat TEXT,
  lng TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
)`,
        `INSERT INTO delivery_events_new (id, delivery_id, courier_id, event_type, lat, lng, metadata, created_at) SELECT id, delivery_id, courier_id, event_type, lat, lng, metadata, created_at FROM delivery_events`,
        `DROP TABLE delivery_events`,
        `ALTER TABLE delivery_events_new RENAME TO delivery_events`,
        `CREATE INDEX IF NOT EXISTS idx_delivery_events_delivery ON delivery_events(delivery_id, created_at)`,
        `CREATE INDEX IF NOT EXISTS idx_delivery_events_courier ON delivery_events(courier_id, created_at)`,
      ]);
      created += 1;
      console.log('rebuilt delivery_events: CHECK menyertakan notify_arriving/notify_arrived');
    } else {
      console.log('delivery_events sudah memiliki enum lengkap, dilewati');
    }
  } catch (error) {
    errors += 1;
    console.error(`ERROR delivery_events rebuild: ${(error as Error).message}`);
  }

  for (const statement of fkIndexStatements) {
    try {
      await runWithRetry(client, statement);
      created += 1;
    } catch (error) {
      errors += 1;
      console.error(`ERROR FK index:\n  ${statement}\n  ${(error as Error).message}`);
    }
  }

  console.log(`\nv29 selesai: ok=${created}, errors=${errors}`);
  if (errors > 0) process.exitCode = 1;
  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
