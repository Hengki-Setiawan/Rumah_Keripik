import { db } from '@/lib/db';
import { chatSessions } from '@/lib/schema';
import { eq, lt, sql } from 'drizzle-orm';

const EXPIRY_HOURS = 24;

export async function cleanupExpiredSessions() {
  const cutoff = new Date(Date.now() - EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  const expired = await db
    .select({ id: chatSessions.id, updatedAt: chatSessions.updatedAt })
    .from(chatSessions)
    .where(lt(chatSessions.updatedAt, cutoff))
    .where(eq(chatSessions.status, 'active'));

  if (expired.length === 0) return { archived: 0 };

  await db
    .update(chatSessions)
    .set({ status: 'archived', updatedAt: sql`(datetime('now', 'utc'))` })
    .where(lt(chatSessions.updatedAt, cutoff))
    .where(eq(chatSessions.status, 'active'));

  return { archived: expired.length };
}

if (require.main === module) {
  cleanupExpiredSessions()
    .then((result) => console.log(`Cleanup selesai: ${result.archived} sesi diarsipkan`))
    .catch((err) => console.error('Cleanup gagal:', err));
}
