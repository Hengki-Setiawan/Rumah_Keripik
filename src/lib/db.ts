import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client/http';
import * as schema from './schema';

// Singleton pattern untuk Next.js (mencegah koneksi baru di setiap hot reload)
const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle>;
};

function createDb() {
  const rawUrl = process.env.TURSO_DATABASE_URL!;
  // Konversi libsql:// → https:// agar langsung pakai HttpClient
  // dan menghindari bug getIsSchemaDatabase() pada lib-esm yang
  // menyebabkan semua query gagal diam-diam di Vercel production
  const url = rawUrl.replace(/^libsql:\/\//, 'https://');

  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  return drizzle(client, { schema });
}

export const db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db;
}

