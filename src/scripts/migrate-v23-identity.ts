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
    `CREATE TABLE IF NOT EXISTS otp_requests (
      id TEXT PRIMARY KEY,
      phone_number TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT 'checkout_verification',
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_otp_phone_created ON otp_requests (phone_number, created_at)`,
    `CREATE TABLE IF NOT EXISTS device_tokens (
      id TEXT PRIMARY KEY,
      display_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE TABLE IF NOT EXISTS device_identity_links (
      id TEXT PRIMARY KEY,
      device_token_id TEXT NOT NULL REFERENCES device_tokens(id),
      customer_id TEXT NOT NULL REFERENCES customer_profile(id_customer),
      linked_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_device_customer_link ON device_identity_links (device_token_id, customer_id)`,
    `CREATE TABLE IF NOT EXISTS oauth_links (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customer_profile(id_customer),
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      email TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_oauth_provider_account ON oauth_links (provider, provider_account_id)`,
    `CREATE TABLE IF NOT EXISTS chat_identity_flows (
      id TEXT PRIMARY KEY,
      chat_session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL DEFAULT 'checkout_verification',
      step TEXT NOT NULL DEFAULT 'ask_prior_order',
      phone_number TEXT,
      display_name TEXT,
      address_text TEXT,
      address_note TEXT,
      address_lat TEXT,
      address_lng TEXT,
      maps_link TEXT,
      otp_request_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_identity_flow_session ON chat_identity_flows (chat_session_id)`,
  ];

  for (const statement of statements) await client.execute(statement);
  console.log('migrate-v23 (progressive identity: otp, device, oauth, flow) completed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});