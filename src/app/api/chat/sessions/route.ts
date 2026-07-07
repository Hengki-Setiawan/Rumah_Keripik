import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatSessions, customerSessions } from '@/lib/schema';
import { CUSTOMER_SESSION_COOKIE, ensureCustomerSession, hashCustomerSessionToken } from '@/lib/chat-v3/session';

export async function GET(req: Request) {
  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ ok: true, sessions: [] });

  const [customerSession] = await db
    .select()
    .from(customerSessions)
    .where(eq(customerSessions.sessionTokenHash, hashCustomerSessionToken(token)))
    .limit(1);
  if (!customerSession) return NextResponse.json({ ok: true, sessions: [] });

  const sessions = await db
    .select({ id: chatSessions.id, title: chatSessions.title, status: chatSessions.status, aiMode: chatSessions.aiMode, activeOrderId: chatSessions.activeOrderId, updatedAt: chatSessions.updatedAt, createdAt: chatSessions.createdAt })
    .from(chatSessions)
    .where(eq(chatSessions.customerSessionId, customerSession.id))
    .orderBy(desc(chatSessions.updatedAt))
    .limit(30);

  return NextResponse.json({ ok: true, sessions });
}

export async function POST(req: Request) {
  const customerSession = await ensureCustomerSession(req, (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value);
  const { ensureActiveChatSession } = await import('@/lib/chat-v3/session');
  const { chatSession } = await ensureActiveChatSession(customerSession.session.id);
  return NextResponse.json({ ok: true, chatSession: { id: chatSession.id, title: chatSession.title, status: chatSession.status } });
}
