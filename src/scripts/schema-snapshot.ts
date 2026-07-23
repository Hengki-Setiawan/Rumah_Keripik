/**
 * Generate schema snapshot — simpan hasilnya ke _ctx/SCHEMA_SNAPSHOT.md
 * Jalankan: npx tsx src/scripts/schema-snapshot.ts
 */

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

  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  const lines: string[] = ['# Schema Snapshot — Rumah Keripik', `> Generated: ${new Date().toISOString()}`, '', `**Total Tables: ${tables.rows.length}**`, '', '## Table List', ''];
  tables.rows.forEach((row: any) => lines.push(`- \`${row.name}\``));

  lines.push('', '## Schema Detail', '');
  for (const table of tables.rows) {
    const name = String(table.name);
    const info = await client.execute(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${name}'`);
    const sql = info.rows[0]?.sql || '';
    lines.push(`### ${name}`);
    lines.push('```sql', String(sql), '```', '');

    const count = await client.execute(`SELECT COUNT(*) as cnt FROM "${name}"`);
    lines.push(`Rows: ${count.rows[0]?.cnt || 0}`, '');
  }

  const outDir = path.join(process.cwd(), '_ctx');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'SCHEMA_SNAPSHOT.md');
  fs.writeFileSync(outPath, lines.join('\n'));
  console.log(`Schema snapshot written to ${outPath} (${tables.rows.length} tables)`);
}

main().catch((error) => { console.error(error); process.exit(1); });
