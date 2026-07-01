import fs from 'fs';
import path from 'path';
import { createClient } from '@libsql/client';

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index <= 0) continue;
    process.env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
}

async function addColumnIfMissing(client: ReturnType<typeof createClient>, table: string, column: string, ddl: string) {
  const info = await client.execute(`PRAGMA table_info(${table})`);
  const exists = info.rows.some((row) => row.name === column);
  if (exists) return;
  await client.execute(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

async function main() {
  loadEnvLocal();

  const url = process.env.TURSO_DATABASE_URL?.replace(/^libsql:\/\//, 'https://');
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error('TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN wajib ada.');

  const client = createClient({ url, authToken });

  console.log('Running v4 integration fixes...');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS zona_pengiriman (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama_zona TEXT NOT NULL,
      lat_pusat TEXT NOT NULL,
      lng_pusat TEXT NOT NULL,
      radius_km INTEGER NOT NULL DEFAULT 5,
      ongkir_min INTEGER NOT NULL DEFAULT 0,
      ongkir_max INTEGER NOT NULL DEFAULT 0,
      total_order_bulan_ini INTEGER DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    )
  `);

  await addColumnIfMissing(client, 'transaksi', 'invoice_url', 'invoice_url TEXT');

  console.log('v4 integration fixes completed.');
}

main().catch((error) => {
  console.error('v4 integration fixes failed:', error);
  process.exit(1);
});
