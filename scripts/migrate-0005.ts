import { createClient } from '@libsql/client';

async function main() {
  const url = (process.env.TURSO_DATABASE_URL || '').replace(/^libsql:\/\//, 'https://');
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  await client.execute('ALTER TABLE delivery_assignment ADD COLUMN signature_url text;');
  console.log('Migration 0005 applied: added signature_url to delivery_assignment');
}
main().catch(console.error);
