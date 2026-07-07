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
    `CREATE TABLE IF NOT EXISTS customer_sessions (id TEXT PRIMARY KEY, customer_id TEXT REFERENCES customer_profile(id_customer), session_token_hash TEXT NOT NULL UNIQUE, anonymous_label TEXT, user_agent_hash TEXT, ip_hash TEXT, last_seen_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), expires_at TEXT NOT NULL, revoked_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))`,
    `CREATE INDEX IF NOT EXISTS idx_customer_sessions_token_hash ON customer_sessions(session_token_hash)`,
    `CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer ON customer_sessions(customer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_customer_sessions_last_seen ON customer_sessions(last_seen_at)`,
    `CREATE TABLE IF NOT EXISTS chat_sessions (id TEXT PRIMARY KEY, customer_id TEXT REFERENCES customer_profile(id_customer), customer_session_id TEXT NOT NULL REFERENCES customer_sessions(id) ON DELETE CASCADE, title TEXT, status TEXT NOT NULL DEFAULT 'active', ai_mode TEXT NOT NULL DEFAULT 'enabled', assigned_admin_id TEXT, active_order_id TEXT REFERENCES transaksi(id_transaksi), created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))`,
    `CREATE INDEX IF NOT EXISTS idx_chat_sessions_customer_session ON chat_sessions(customer_session_id, updated_at)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_sessions_customer ON chat_sessions(customer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status, updated_at)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_sessions_order ON chat_sessions(active_order_id)`,
    `CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, chat_session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE, role TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', component_json TEXT, metadata_json TEXT, token_estimate INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))`,
    `CREATE INDEX IF NOT EXISTS idx_chat_messages_session_time ON chat_messages(chat_session_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_messages_role ON chat_messages(role)`,
    `CREATE TABLE IF NOT EXISTS chat_carts (id TEXT PRIMARY KEY, chat_session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE, customer_id TEXT REFERENCES customer_profile(id_customer), status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))`,
    `CREATE INDEX IF NOT EXISTS idx_chat_carts_session_status ON chat_carts(chat_session_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_carts_customer ON chat_carts(customer_id)`,
    `CREATE TABLE IF NOT EXISTS chat_cart_items (id TEXT PRIMARY KEY, cart_id TEXT NOT NULL REFERENCES chat_carts(id) ON DELETE CASCADE, product_id TEXT NOT NULL REFERENCES produk(id_produk) ON DELETE RESTRICT, variant_id TEXT REFERENCES produk_varian(id_varian), quantity INTEGER NOT NULL, price_snapshot INTEGER NOT NULL, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))`,
    `CREATE INDEX IF NOT EXISTS idx_chat_cart_items_cart ON chat_cart_items(cart_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_cart_items_cart_product_variant ON chat_cart_items(cart_id, product_id, variant_id)`,
    `CREATE TABLE IF NOT EXISTS customer_memory_v3 (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customer_profile(id_customer) ON DELETE CASCADE, key TEXT NOT NULL, value TEXT NOT NULL, confidence INTEGER NOT NULL DEFAULT 70, source TEXT NOT NULL DEFAULT 'system', visibility TEXT NOT NULL DEFAULT 'both', reviewed_by_admin INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')), updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))`,
    `CREATE INDEX IF NOT EXISTS idx_customer_memory_v3_customer_key ON customer_memory_v3(customer_id, key)`,
    `CREATE TABLE IF NOT EXISTS ai_runs (id TEXT PRIMARY KEY, chat_session_id TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL, message_id TEXT, task TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, latency_ms INTEGER, status TEXT NOT NULL, error_message TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))`,
    `CREATE INDEX IF NOT EXISTS idx_ai_runs_chat ON ai_runs(chat_session_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_ai_runs_task ON ai_runs(task, created_at)`,
    `CREATE TABLE IF NOT EXISTS ai_tool_calls (id TEXT PRIMARY KEY, ai_run_id TEXT REFERENCES ai_runs(id) ON DELETE CASCADE, chat_session_id TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL, tool_name TEXT NOT NULL, input_json TEXT, output_json TEXT, status TEXT NOT NULL DEFAULT 'success', latency_ms INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))`,
    `CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_run ON ai_tool_calls(ai_run_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_chat ON ai_tool_calls(chat_session_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_tool ON ai_tool_calls(tool_name)`,
  ];

  for (const statement of statements) await client.execute(statement);
  console.log('chat v3 migration completed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
