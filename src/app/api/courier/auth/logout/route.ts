import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courierSessions } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { verifyCourierAuth } from '@/lib/courier/auth';

export async function POST(req: Request) {
  try {
    const auth = await verifyCourierAuth(req);
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    await db.update(courierSessions).set({ is_active: false })
      .where(and(eq(courierSessions.courierId, auth.courierId), eq(courierSessions.is_active, true)));

    return NextResponse.json({ ok: true, data: { message: 'Logout berhasil' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal logout' }, { status: 500 });
  }
}
