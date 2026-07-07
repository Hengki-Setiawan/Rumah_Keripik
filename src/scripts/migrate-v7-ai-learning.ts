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
    `CREATE TABLE IF NOT EXISTS recommendation_events (id TEXT PRIMARY KEY, chat_session_id TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL, customer_id TEXT REFERENCES customer_profile(id_customer) ON DELETE SET NULL, event_type TEXT NOT NULL, product_ids_json TEXT NOT NULL DEFAULT '[]', selected_product_id TEXT REFERENCES produk(id_produk) ON DELETE SET NULL, reason TEXT, metadata_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))`,
    `CREATE INDEX IF NOT EXISTS idx_recommendation_events_chat ON recommendation_events(chat_session_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_recommendation_events_customer ON recommendation_events(customer_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_recommendation_events_type ON recommendation_events(event_type, created_at)`,
    `CREATE TABLE IF NOT EXISTS ai_learning_events (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, chat_session_id TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL, customer_id_hash TEXT, intent TEXT, product_ids_json TEXT NOT NULL DEFAULT '[]', outcome TEXT, rating INTEGER, metadata_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))`,
    `CREATE INDEX IF NOT EXISTS idx_ai_learning_events_type ON ai_learning_events(event_type, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_ai_learning_events_chat ON ai_learning_events(chat_session_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_ai_learning_events_intent ON ai_learning_events(intent, created_at)`,
  ];

  for (const statement of statements) await client.execute(statement);
  console.log('ai learning migration completed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
