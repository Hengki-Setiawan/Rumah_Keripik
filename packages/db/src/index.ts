import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client/web';
import * as schema from './schema';

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle>;
};

function createDb() {
  const rawUrl = process.env.TURSO_DATABASE_URL || '';
  const isLocalFile = !rawUrl || rawUrl.startsWith('file:');
  
  const url = isLocalFile ? 'http://127.0.0.1:8080' : rawUrl.replace(/^libsql:\/\//, 'https://');

  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

  return drizzle(client, { schema });
}

export const db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db;
}

export * from './schema';
