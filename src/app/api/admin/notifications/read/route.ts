import { NextResponse } from 'next/server';
import { requireAdminRole } from '@/lib/admin-actor';
import { markAdminNotificationsRead } from '@/lib/admin-notifications';

export async function POST() {
  try {
    await requireAdminRole('audit:read');
    await markAdminNotificationsRead();
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[ADMIN_NOTIFICATIONS_READ]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}