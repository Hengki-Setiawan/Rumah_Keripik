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

// v30: tabel telegram_admin_chats — penerima notifikasi bot Telegram untuk admin.
// Idempotent: aman dijalankan ulang.

const statements = [
  `CREATE TABLE IF NOT EXISTS telegram_admin_chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL UNIQUE,
  nama TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
)`,
];

async function main() {
  loadEnvLocal();
  const url = process.env.TURSO_DATABASE_URL?.replace(/^libsql:\/\//, 'https://');
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error('TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN wajib ada.');
  const client = createClient({ url, authToken });

  let created = 0;
  let errors = 0;

  for (const statement of statements) {
    try {
      await runWithRetry(client, statement);
      created += 1;
    } catch (error) {
      errors += 1;
      console.error(`ERROR telegram_admin_chats:\n  ${statement}\n  ${(error as Error).message}`);
    }
  }

  console.log(`\nv30 selesai: ok=${created}, errors=${errors}`);
  if (errors > 0) process.exitCode = 1;
  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
