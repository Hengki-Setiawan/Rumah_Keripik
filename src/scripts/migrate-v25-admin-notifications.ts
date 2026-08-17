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

  const existing = await client.execute(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='admin_notifications'`);
  if (existing.rows.length === 0) {
    await client.execute(`
      CREATE TABLE admin_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL CHECK(category IN ('stock','payment','dispatch','delivery','system','order')),
        title TEXT NOT NULL,
        body TEXT,
        meta_json TEXT,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
      )
    `);
    await client.execute(`CREATE INDEX idx_admin_notif_read ON admin_notifications(is_read, created_at)`);
    await client.execute(`CREATE INDEX idx_admin_notif_category ON admin_notifications(category, created_at)`);
    console.log('Tabel admin_notifications dibuat.');
  } else {
    console.log('admin_notifications sudah ada — dilewati.');
  }

  console.log('Migrasi v25 (admin notifications inbox) selesai.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });