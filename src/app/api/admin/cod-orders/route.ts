import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { transaksi } from '@/lib/schema';

export async function GET() {
  const orders = await db.select().from(transaksi).where(eq(transaksi.payment_method, 'cod')).orderBy(desc(transaksi.waktu_simpan)).limit(100);
  return NextResponse.json({ ok: true, orders });
}
