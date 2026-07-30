import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sosEvents } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminRole('sos:respond');

    const { id } = await params;
    const body = await req.json();

    if (body.status === 'resolved') {
      await db.update(sosEvents)
        .set({ status: 'resolved', note: body.responseNote || null, resolvedAt: new Date().toISOString() })
        .where(eq(sosEvents.id, Number(id)));
    } else {
      await db.update(sosEvents)
        .set({ status: body.status, note: body.responseNote || null })
        .where(eq(sosEvents.id, Number(id)));
    }

    const [result] = await db.select({ id: sosEvents.id, status: sosEvents.status })
      .from(sosEvents)
      .where(eq(sosEvents.id, Number(id)))
      .limit(1);

    return NextResponse.json({ ok: true, data: { id: result?.id, status: result?.status } });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal update insiden' }, { status: 500 });
  }
}
