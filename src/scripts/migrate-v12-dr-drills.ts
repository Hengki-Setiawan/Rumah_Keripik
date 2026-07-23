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
    `CREATE TABLE IF NOT EXISTS backup_restore_drills (
      id TEXT PRIMARY KEY,
      drill_date TEXT NOT NULL,
      backup_snapshot_id TEXT NOT NULL,
      restore_target_env TEXT NOT NULL DEFAULT 'staging',
      success INTEGER NOT NULL DEFAULT 0,
      duration_seconds INTEGER,
      issues_found TEXT,
      performed_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
  ];

  for (const statement of statements) await client.execute(statement);
  console.log('migrate-v12 (disaster recovery drills) completed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
