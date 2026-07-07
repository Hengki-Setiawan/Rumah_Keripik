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
    `CREATE TABLE IF NOT EXISTS admin_audit_log (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT, ip_hash TEXT, user_agent_hash TEXT, metadata_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')))`,
    `CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit_log(actor, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_log(action, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_admin_audit_resource ON admin_audit_log(resource_type, resource_id, created_at)`,
  ];

  for (const statement of statements) await client.execute(statement);
  console.log('production hardening migration completed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
