import { cookies } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { chatSessions, customerSessions } from '@/lib/schema';
import { CUSTOMER_SESSION_COOKIE, hashCustomerSessionToken } from '@/lib/chat-v3/session';

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ ok: false, error: 'Session pelanggan tidak ditemukan' }, { status: 401 });

  const tokenHash = hashCustomerSessionToken(token);
  const [owned] = await db
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .innerJoin(customerSessions, eq(chatSessions.customerSessionId, customerSessions.id))
    .where(and(eq(chatSessions.id, id), eq(customerSessions.sessionTokenHash, tokenHash)))
    .limit(1);

  if (!owned) return NextResponse.json({ ok: false, error: 'Riwayat chat tidak ditemukan' }, { status: 404 });

  await db.delete(chatSessions).where(eq(chatSessions.id, id));
  return NextResponse.json({ ok: true });
}
