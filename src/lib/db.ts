import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

// Singleton pattern untuk Next.js (mencegah koneksi baru di setiap hot reload)
const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle>;
};

function createDb() {
  const rawUrl = process.env.TURSO_DATABASE_URL!;
  const isLocalFile = rawUrl.startsWith('file:');
  // Untuk production tetap ubah libsql:// -> https:// agar koneksi Turso
  // stabil, tapi mode test lokal bisa memakai file: tanpa network.
  const url = isLocalFile ? rawUrl : rawUrl.replace(/^libsql:\/\//, 'https://');

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
