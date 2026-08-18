import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transaksi, pelangganChatbot, sosEvents } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';
import { getUnreadAdminNotificationCount } from '@/lib/admin-notifications';
import { adminAuthErrorResponse, requireAdminRole } from '@/lib/admin-actor';

export async function GET() {
  try {
    await requireAdminRole('audit:read');
    const [pendingVerif] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(transaksi)
      .where(eq(transaksi.status_pembayaran, 'Menunggu_Verifikasi'));

    const [unreadChats] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(pelangganChatbot)
      .where(eq(pelangganChatbot.status_handle, 'Manual_Admin'));

    const [activeSos] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(sosEvents)
      .where(eq(sosEvents.status, 'active'));

    const adminNotifs = await getUnreadAdminNotificationCount();

    return NextResponse.json({
      pending_verifikasi: pendingVerif.count,
      unread_chats: unreadChats.count,
      active_sos: activeSos.count,
      admin_notifications: adminNotifs,
    });
  } catch (err) {
    const authResponse = adminAuthErrorResponse(err);
    if (authResponse) return authResponse;
    console.error('[NotificationCounts]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
