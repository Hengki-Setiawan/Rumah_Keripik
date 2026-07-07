import { cookies } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatSessions, customerSessions } from '@/lib/schema';
import { CUSTOMER_SESSION_COOKIE, hashCustomerSessionToken } from './session';

export async function requireOwnedChatSession(chatSessionId: string) {
  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!token) throw new Error('CHAT_SESSION_UNAUTHORIZED');

  const tokenHash = hashCustomerSessionToken(token);
  const [row] = await db
    .select({ chatSession: chatSessions, customerSession: customerSessions })
    .from(chatSessions)
    .innerJoin(customerSessions, eq(chatSessions.customerSessionId, customerSessions.id))
    .where(and(eq(chatSessions.id, chatSessionId), eq(customerSessions.sessionTokenHash, tokenHash), isNull(customerSessions.revokedAt)))
    .limit(1);

  if (!row) throw new Error('CHAT_SESSION_FORBIDDEN');
  return row.chatSession;
}

export function chatOwnershipErrorResponse(error: unknown) {
  if (!(error instanceof Error)) return null;
  if (error.message === 'CHAT_SESSION_UNAUTHORIZED') return { status: 401, error: 'Session customer tidak ditemukan' };
  if (error.message === 'CHAT_SESSION_FORBIDDEN') return { status: 403, error: 'Chat session bukan milik session ini' };
  return null;
}
