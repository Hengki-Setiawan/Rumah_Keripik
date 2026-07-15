import { NextResponse } from 'next/server';
import { getChatMessages } from '@/lib/chat-v3/messages';
import { getChatCart } from '@/lib/ai/tools/cart';
import { getCustomerContextForChat } from '@/lib/chat-v3/customer-context';
import { getChatV3Stage } from '@/lib/chat-v3/stage';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { chatOwnershipErrorResponse, requireOwnedChatSession } from '@/lib/chat-v3/ownership';

export async function GET(req: Request) {
  const rate = await checkRateLimit(`chat-state:${getClientIp(req)}`, 120, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak refresh chat.' }, { status: 429 });

  const { searchParams } = new URL(req.url);
  const chatSessionId = searchParams.get('chatSessionId') || '';
  if (!chatSessionId) return NextResponse.json({ ok: false, error: 'Chat session wajib ada' }, { status: 400 });

  let chatSession;
  try {
    chatSession = await requireOwnedChatSession(chatSessionId);
  } catch (error) {
    const ownership = chatOwnershipErrorResponse(error);
    if (ownership) return NextResponse.json({ ok: false, error: ownership.error }, { status: ownership.status });
    throw error;
  }

  const [messages, cart, customerContext, stage] = await Promise.all([
    getChatMessages(chatSessionId),
    getChatCart(chatSessionId),
    getCustomerContextForChat(chatSessionId),
    getChatV3Stage(chatSessionId),
  ]);

  return NextResponse.json({ ok: true, chatSession, messages, cart, customerContext, stage });
}
