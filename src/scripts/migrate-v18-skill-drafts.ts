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

  const statement = `
    CREATE TABLE IF NOT EXISTS skill_drafts (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_chat_session_id TEXT,
      source_conversation_excerpt TEXT,
      draft_markdown TEXT NOT NULL,
      proposed_name TEXT NOT NULL,
      proposed_description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('pending_review','approved','rejected')),
      reviewed_by TEXT,
      reviewed_at TEXT,
      rejection_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
  `;

  await client.execute(statement);
  console.log('migrate-v18 (skill_drafts for Human-in-the-Loop Agent Teaching) completed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
