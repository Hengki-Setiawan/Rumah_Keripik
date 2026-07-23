import { NextResponse } from 'next/server';
import { eq, gt, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatMessages, chatSessions } from '@/lib/schema';
import { getChatCart } from '@/lib/ai/tools/cart';
import { getCustomerContextForChat } from '@/lib/chat-v3/customer-context';
import { chatOwnershipErrorResponse, requireOwnedChatSession } from '@/lib/chat-v3/ownership';
import { getChatMessages } from '@/lib/chat-v3/messages';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const rate = await checkRateLimit(`chat-poll:${getClientIp(req)}`, 60, 60_000);
  if (!rate.ok) {
    return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const chatSessionId = searchParams.get('chatSessionId') || '';
  const lastCreatedAt = searchParams.get('since') || '';

  if (!chatSessionId) {
    return NextResponse.json({ ok: false, error: 'Chat session wajib ada' }, { status: 400 });
  }

  try {
    await requireOwnedChatSession(chatSessionId);
  } catch (error) {
    const ownership = chatOwnershipErrorResponse(error);
    if (ownership) return NextResponse.json({ ok: false, error: ownership.error }, { status: ownership.status });
    throw error;
  }

  const [session] = await db
    .select({ updatedAt: chatSessions.updatedAt })
    .from(chatSessions)
    .where(eq(chatSessions.id, chatSessionId))
    .limit(1);

  if (!session) {
    return NextResponse.json({ ok: false, error: 'Sesi tidak ditemukan' }, { status: 404 });
  }

  const hasChanges = lastCreatedAt
    ? await db
        .select({ id: chatMessages.id })
        .from(chatMessages)
        .where(and(eq(chatMessages.chatSessionId, chatSessionId), gt(chatMessages.createdAt, lastCreatedAt)))
        .limit(1)
        .then((rows: Array<{ id: string }>) => rows.length > 0)
    : true;

  if (!hasChanges) {
    return NextResponse.json({ ok: true, changed: false, updatedAt: session.updatedAt });
  }

  const [messages, cart, customerContext] = await Promise.all([
    getChatMessages(chatSessionId),
    getChatCart(chatSessionId),
    getCustomerContextForChat(chatSessionId),
  ]);

  return NextResponse.json({
    ok: true,
    changed: true,
    messages,
    cart,
    customerContext,
    updatedAt: session.updatedAt,
  });
}
