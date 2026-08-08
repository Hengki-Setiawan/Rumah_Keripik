import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { transaksi } from '@/lib/schema';
import { requireAdminRole } from '@/lib/admin-actor';

export async function GET() {
  try {
    await requireAdminRole('order:update');
    const orders = await db.select().from(transaksi).where(eq(transaksi.payment_method, 'cod')).orderBy(desc(transaksi.waktu_simpan)).limit(100);
    return NextResponse.json({ ok: true, orders });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal' }, { status: 500 });
  }
}
