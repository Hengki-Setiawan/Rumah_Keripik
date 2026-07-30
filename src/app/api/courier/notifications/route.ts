import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notifications } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { verifyCourierAuth } from '@/lib/courier/auth';

export async function GET(req: Request) {
  try {
    const auth = await verifyCourierAuth(req);
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const limit = Number(url.searchParams.get('limit') || 50);
    const unreadOnly = url.searchParams.get('unread') === 'true';

    const conditions = unreadOnly
      ? and(eq(notifications.courierId, auth.courierId), eq(notifications.isRead, false))
      : eq(notifications.courierId, auth.courierId);

    const result = await db.select()
      .from(notifications)
      .where(conditions)
      .orderBy(sql`${notifications.createdAt} desc`)
      .limit(limit);

    const unreadCount = await db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.courierId, auth.courierId), eq(notifications.isRead, false)));

    return NextResponse.json({
      ok: true,
      data: {
        notifications: result,
        unreadCount: Number(unreadCount[0]?.count || 0),
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal ambil notifikasi' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await verifyCourierAuth(req);
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (body.markAllRead) {
      await db.update(notifications).set({ isRead: true })
        .where(and(eq(notifications.courierId, auth.courierId), eq(notifications.isRead, false)));
    } else if (body.notificationId) {
      await db.update(notifications).set({ isRead: true })
        .where(and(eq(notifications.id, body.notificationId), eq(notifications.courierId, auth.courierId)));
    }

    return NextResponse.json({ ok: true, data: { message: 'Updated' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal update' }, { status: 500 });
  }
}
