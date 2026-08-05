import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notificationLog } from '@/lib/schema';
import { desc } from 'drizzle-orm';
import { requireAdminRole, isForbiddenAdminPermissionError, isUnauthorizedAdminError } from '@/lib/admin-actor';

export async function GET(req: Request) {
  try {
    await requireAdminRole('sos:view');
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
    const status = url.searchParams.get('status');
    const recipientType = url.searchParams.get('recipientType');

    const rows = await db
      .select()
      .from(notificationLog)
      .orderBy(desc(notificationLog.serverSentAt))
      .limit(limit);

    const filtered = rows.filter((r) => {
      if (status && r.deliveryStatus !== status) return false;
      if (recipientType && r.recipientType !== recipientType) return false;
      return true;
    });

    const summary = {
      total: filtered.length,
      sent: filtered.filter((r) => r.deliveryStatus === 'sent').length,
      deviceConfirmed: filtered.filter((r) => r.deliveryStatus === 'device_confirmed').length,
      opened: filtered.filter((r) => r.deliveryStatus === 'opened').length,
      failed: filtered.filter((r) => r.deliveryStatus === 'failed').length,
    };

    return NextResponse.json({ ok: true, logs: filtered, summary });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    console.error('[ADMIN_NOTIFICATION_LOG]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
