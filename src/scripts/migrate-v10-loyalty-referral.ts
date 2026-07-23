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
    `CREATE TABLE IF NOT EXISTS loyalty_accounts (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customer_profile(id_customer) ON DELETE CASCADE,
      points_balance INTEGER NOT NULL DEFAULT 0,
      tier TEXT NOT NULL DEFAULT 'bronze' CHECK(tier IN ('bronze','silver','gold')),
      referral_code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_loyalty_customer ON loyalty_accounts(customer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_loyalty_tier ON loyalty_accounts(tier)`,

    `CREATE TABLE IF NOT EXISTS loyalty_ledger (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL CHECK(reason IN ('order_completed','referral_bonus','redeemed','admin_adjustment')),
      related_order_id TEXT,
      balance_after INTEGER NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_account ON loyalty_ledger(account_id, created_at)`,

    `CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      referrer_account_id TEXT NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
      referee_customer_id TEXT REFERENCES customer_profile(id_customer),
      code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','used','expired')),
      bonus_points_awarded INTEGER,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_account_id)`,
    `CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status)`,
  ];

  for (const statement of statements) await client.execute(statement);
  console.log('migrate-v10 (loyalty & referral) completed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
