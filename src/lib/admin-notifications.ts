import { db } from '@/lib/db';
import { adminNotifications } from '@/lib/schema';
import { desc, eq, sql } from 'drizzle-orm';

export type AdminNotifCategory = 'stock' | 'payment' | 'dispatch' | 'delivery' | 'system' | 'order';

export async function createAdminNotification(input: {
  category: AdminNotifCategory;
  title: string;
  body?: string;
  metaJson?: Record<string, unknown>;
}) {
  try {
    await db.insert(adminNotifications).values({
      category: input.category,
      title: input.title,
      body: input.body ?? null,
      metaJson: input.metaJson ? JSON.stringify(input.metaJson) : null,
    });
    return true;
  } catch (err) {
    console.error('[AdminNotification] create failed:', err);
    return false;
  }
}

export async function listAdminNotifications(limit = 50) {
  return db
    .select()
    .from(adminNotifications)
    .orderBy(desc(adminNotifications.createdAt))
    .limit(limit);
}

export async function getUnreadAdminNotificationCount() {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(adminNotifications)
    .where(eq(adminNotifications.isRead, false));
  return row?.count ?? 0;
}

export async function markAdminNotificationsRead() {
  await db
    .update(adminNotifications)
    .set({ isRead: true })
    .where(eq(adminNotifications.isRead, false));
}