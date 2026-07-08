import { NextResponse } from 'next/server';
import { createChatMessage, getChatMessages } from '@/lib/chat-v3/messages';
import { SendChatSchema } from '@/lib/chat-v3/schemas';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getChatCart } from '@/lib/ai/tools/cart';
import { buildChatResponse, buildPausedChatResponse } from '@/lib/ai/orchestrator';
import { rememberChatSignals } from '@/lib/chat-v3/memory';
import { chatOwnershipErrorResponse, requireOwnedChatSession } from '@/lib/chat-v3/ownership';
import { updateChatSessionTitle } from '@/lib/chat-v3/session-title';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const rate = checkRateLimit(`chat-v3:${getClientIp(req)}`, 40, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak chat. Coba lagi sebentar.' }, { status: 429 });

  const parsed = SendChatSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Pesan tidak valid' }, { status: 400 });

  const chatSessionId = parsed.data.chatSessionId;
  if (!chatSessionId) return NextResponse.json({ ok: false, error: 'Chat session belum siap' }, { status: 400 });

  let chatSession;
  try {
    chatSession = await requireOwnedChatSession(chatSessionId);
  } catch (error) {
    const ownership = chatOwnershipErrorResponse(error);
    if (ownership) return NextResponse.json({ ok: false, error: ownership.error }, { status: ownership.status });
    throw error;
  }
  let userMessage;
  let aiResponse;

  if (chatSession.aiMode !== 'enabled') {
    aiResponse = await buildPausedChatResponse(chatSessionId, parsed.data.message);
    if (!aiResponse) {
      return NextResponse.json({ ok: false, error: 'Chat sedang di-handle admin. Tunggu balasan admin ya kak.' }, { status: 409 });
    }
    userMessage = await createChatMessage({ chatSessionId, role: 'user', content: parsed.data.message });
  } else {
    userMessage = await createChatMessage({ chatSessionId, role: 'user', content: parsed.data.message });
    rememberChatSignals(chatSessionId, parsed.data.message).catch(() => undefined);
    aiResponse = await buildChatResponse(chatSessionId, parsed.data.message);
  }

  const assistantMessage = await createChatMessage({
    chatSessionId,
    role: aiResponse.intent === 'handoff_to_admin' ? 'system' : 'assistant',
    content: aiResponse.reply,
    components: aiResponse.components,
    metadata: { intent: aiResponse.intent, nextAction: aiResponse.nextAction, confidence: aiResponse.confidence },
  });

  await updateChatSessionTitle(chatSessionId, parsed.data.message, aiResponse.intent);

  return NextResponse.json({ ok: true, userMessage, assistantMessage, response: aiResponse, messages: await getChatMessages(chatSessionId), cart: await getChatCart(chatSessionId) });
}
