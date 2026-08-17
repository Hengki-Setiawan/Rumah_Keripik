import { NextResponse } from 'next/server';
import { requireAdminRole } from '@/lib/admin-actor';
import { listAdminNotifications, getUnreadAdminNotificationCount } from '@/lib/admin-notifications';

export async function GET(request: Request) {
  try {
    await requireAdminRole('audit:read');

    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 50)));

    const [notifs, unread] = await Promise.all([
      listAdminNotifications(limit),
      getUnreadAdminNotificationCount(),
    ]);

    return NextResponse.json({
      ok: true,
      notifications: notifs.map((n) => ({
        id: n.id,
        category: n.category,
        title: n.title,
        body: n.body,
        meta: n.metaJson ? JSON.parse(n.metaJson) : null,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
      unread,
    });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[ADMIN_NOTIFICATIONS]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}