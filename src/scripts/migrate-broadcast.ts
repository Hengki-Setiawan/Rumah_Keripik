import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  const sql = readFileSync('src/drizzle/migrations/0003_unique_sandman.sql', 'utf-8');
  const stmts = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);

  for (const stmt of stmts) {
    try {
      await client.execute(stmt);
      console.log('OK:', stmt.slice(0, 60));
    } catch (e: any) {
      console.log('ERR:', e.message);
    }
  }
  console.log('Done');
}

main().catch(console.error);
