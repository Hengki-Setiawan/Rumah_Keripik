import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orderStatusHistory } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ ok: false, error: 'ID pesanan wajib diisi' }, { status: 400 });

    const events = await db
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.id_transaksi, id))
      .orderBy(desc(orderStatusHistory.created_at))
      .limit(50);

    return NextResponse.json({ ok: true, events });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
