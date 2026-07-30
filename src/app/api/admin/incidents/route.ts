import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sosEvents } from '@/lib/schema';
import { desc } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';

export async function GET() {
  try {
    await requireAdminRole('sos:view');

    const result = await db
      .select()
      .from(sosEvents)
      .orderBy(desc(sosEvents.createdAt));

    return NextResponse.json({ ok: true, data: result });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
