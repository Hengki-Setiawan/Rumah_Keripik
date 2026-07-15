import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { createChatSession, CUSTOMER_SESSION_COOKIE, ensureActiveChatSession, ensureCustomerSession, getCustomerSessionMaxAge } from '@/lib/chat-v3/session';
import { getChatMessages } from '@/lib/chat-v3/messages';
import { getChatCart } from '@/lib/ai/tools/cart';
import { getCustomerContextForChat } from '@/lib/chat-v3/customer-context';
import { getChatV3Stage } from '@/lib/chat-v3/stage';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const rate = await checkRateLimit(`customer-session:${getClientIp(req)}`, 120, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak request session. Coba lagi sebentar.' }, { status: 429 });

  const payload = await req.json().catch(() => ({})) as { forceNew?: boolean };
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  const customerSession = await ensureCustomerSession(req, existingToken);
  const { chatSession, isNew } = payload.forceNew
    ? await createChatSession(customerSession.session.id)
    : await ensureActiveChatSession(customerSession.session.id);
  const [messages, cart, customerContext, stage] = await Promise.all([
    getChatMessages(chatSession.id),
    getChatCart(chatSession.id),
    getCustomerContextForChat(chatSession.id),
    getChatV3Stage(chatSession.id),
  ]);

  const response = NextResponse.json({
    ok: true,
    customerSession: {
      id: customerSession.session.id,
      customerId: customerSession.session.customerId,
      anonymousLabel: customerSession.session.anonymousLabel,
    },
    chatSession: {
      id: chatSession.id,
      title: chatSession.title,
      status: chatSession.status,
      aiMode: chatSession.aiMode,
      activeOrderId: chatSession.activeOrderId,
      stage,
      isNew,
    },
    messages,
    cart,
    customerContext,
  });

  response.cookies.set(CUSTOMER_SESSION_COOKIE, customerSession.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && req.headers.get('x-forwarded-proto') === 'https',
    path: '/',
    maxAge: getCustomerSessionMaxAge(),
  });

  return response;
}
