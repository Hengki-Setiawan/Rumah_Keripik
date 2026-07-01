import fs from 'fs';
import path from 'path';
import { createClient } from '@libsql/client';

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();

  const url = process.env.TURSO_DATABASE_URL?.replace(/^libsql:\/\//, 'https://');
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error('TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN wajib ada.');
  }

  const client = createClient({ url, authToken });

  const statements = [
    `CREATE TABLE IF NOT EXISTS order_draft (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      no_wa_pelanggan TEXT NOT NULL REFERENCES pelanggan_chatbot(no_wa_pelanggan),
      channel TEXT NOT NULL DEFAULT 'wa' CHECK (channel IN ('wa', 'telegram')),
      status TEXT NOT NULL DEFAULT 'Profil_Pending' CHECK (status IN ('Profil_Pending','Cart_Pending','Menunggu_Bayar','Menunggu_Verifikasi','Completed','Cancelled')),
      id_transaksi TEXT,
      context_json TEXT NOT NULL,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_order_draft_customer ON order_draft(no_wa_pelanggan)`,
    `CREATE INDEX IF NOT EXISTS idx_order_draft_status ON order_draft(status)`,

    `CREATE TABLE IF NOT EXISTS order_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_transaksi TEXT,
      no_wa_pelanggan TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_payload TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_order_events_tx ON order_events(id_transaksi)`,
    `CREATE INDEX IF NOT EXISTS idx_order_events_customer ON order_events(no_wa_pelanggan)`,

    `CREATE TABLE IF NOT EXISTS worker_job (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','cancelled')),
      priority INTEGER NOT NULL DEFAULT 5,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      locked_by TEXT,
      locked_until TEXT,
      result_json TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_worker_job_status ON worker_job(status, priority, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_worker_job_lock ON worker_job(locked_until)`,

    `CREATE TABLE IF NOT EXISTS worker_heartbeat (
      worker_id TEXT PRIMARY KEY,
      worker_name TEXT,
      status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online','idle','offline')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      meta_json TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS outbound_message_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel TEXT NOT NULL CHECK (channel IN ('wa', 'telegram')),
      recipient_id TEXT NOT NULL,
      message_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','cancelled')),
      attempts INTEGER NOT NULL DEFAULT 0,
      provider_message_id TEXT,
      error_message TEXT,
      scheduled_at TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_outbound_queue_status ON outbound_message_queue(status, scheduled_at)`,

    `CREATE TABLE IF NOT EXISTS geocode_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL UNIQUE,
      lat TEXT,
      lng TEXT,
      formatted_address TEXT,
      provider TEXT NOT NULL DEFAULT 'nominatim',
      confidence INTEGER,
      raw_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,

    `CREATE TABLE IF NOT EXISTS ai_response_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cache_key TEXT NOT NULL UNIQUE,
      prompt_hash TEXT NOT NULL,
      response_text TEXT NOT NULL,
      model_used TEXT,
      tokens_used INTEGER DEFAULT 0,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,

    `CREATE TABLE IF NOT EXISTS ai_learning_review (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trigger_pattern TEXT NOT NULL,
      suggested_response TEXT NOT NULL,
      source_chat_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,

    `CREATE TABLE IF NOT EXISTS delivery_assignment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_transaksi TEXT NOT NULL REFERENCES transaksi(id_transaksi) ON DELETE CASCADE,
      kurir_name TEXT,
      status TEXT NOT NULL DEFAULT 'Siap_Dikirim' CHECK (status IN ('Siap_Dikirim','Dalam_Pengiriman','Terkirim','Gagal')),
      pickup_at TEXT,
      delivered_at TEXT,
      proof_url TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_delivery_assignment_tx ON delivery_assignment(id_transaksi)`,
    `CREATE INDEX IF NOT EXISTS idx_delivery_assignment_status ON delivery_assignment(status)`,

    `CREATE TABLE IF NOT EXISTS delivery_route_point (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_date TEXT NOT NULL,
      id_transaksi TEXT NOT NULL,
      sequence_no INTEGER NOT NULL,
      lat TEXT NOT NULL,
      lng TEXT NOT NULL,
      address TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','visited','skipped'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_delivery_route_date ON delivery_route_point(route_date, sequence_no)`,
  ];

  console.log('Running v3 worker/blueprint migration...');
  for (const statement of statements) {
    await client.execute(statement);
  }
  console.log('v3 migration completed.');
}

main().catch((error) => {
  console.error('v3 migration failed:', error);
  process.exit(1);
});
