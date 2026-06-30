import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transaksi, pelangganChatbot } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

export async function GET() {
  try {
    const [pendingVerif] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(transaksi)
      .where(eq(transaksi.status_pembayaran, 'Menunggu_Verifikasi'));

    const [unreadChats] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(pelangganChatbot)
      .where(eq(pelangganChatbot.status_handle, 'Manual_Admin'));

    return NextResponse.json({
      pending_verifikasi: pendingVerif.count,
      unread_chats: unreadChats.count,
    });
  } catch (err) {
    console.error('[NotificationCounts]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
