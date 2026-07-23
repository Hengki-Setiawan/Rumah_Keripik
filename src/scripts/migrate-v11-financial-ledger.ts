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
    `CREATE TABLE IF NOT EXISTS expense_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('cogs','operational','marketing','other')),
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,

    `CREATE TABLE IF NOT EXISTS ledger_entries (
      id TEXT PRIMARY KEY,
      entry_type TEXT NOT NULL CHECK(entry_type IN ('revenue','expense','refund','adjustment')),
      amount INTEGER NOT NULL,
      category_id TEXT REFERENCES expense_categories(id),
      related_order_id TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      created_by TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ledger_entry_type ON ledger_entries(entry_type, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_ledger_category ON ledger_entries(category_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_ledger_order ON ledger_entries(related_order_id)`,

    `CREATE TABLE IF NOT EXISTS cash_reconciliation (
      id TEXT PRIMARY KEY,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      system_balance INTEGER NOT NULL,
      actual_balance INTEGER,
      discrepancy_note TEXT,
      reconciled_by TEXT,
      reconciled_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
  ];

  for (const statement of statements) await client.execute(statement);
  console.log('migrate-v11 (financial ledger) completed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
