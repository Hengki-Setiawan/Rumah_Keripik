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
  const rate = await checkRateLimit(`chat-v3:${getClientIp(req)}`, 40, 60_000);
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
    try {
      aiResponse = await buildChatResponse(chatSessionId, parsed.data.message);
    } catch (err) {
      console.error('[Chat API] AI orchestrator error:', err);
      aiResponse = {
        reply: 'Maaf kak, koneksi AI kami sedang mengalami kendala. Kakak bisa ketik ulang, atau langsung hubungi admin kami ya!',
        intent: 'handoff_to_admin' as const,
        components: [
          { type: 'admin_handoff_card' as const, reason: 'Koneksi AI terputus' },
          {
            type: 'quick_replies' as const,
            options: [
              { id: 'fb-produk', label: '🛍️ Lihat Katalog', value: 'lihat produk', action: 'send_message' as const },
              { id: 'fb-cart', label: '🛒 Lihat Keranjang', value: 'lihat keranjang', action: 'send_message' as const },
            ]
          }
        ],
        confidence: 0.3
      };
    }
  }

  const assistantMessage = await createChatMessage({
    chatSessionId,
    role: aiResponse.intent === 'handoff_to_admin' ? 'system' : 'assistant',
    content: aiResponse.reply,
    components: aiResponse.components,
    metadata: { intent: aiResponse.intent, nextAction: aiResponse.nextAction, confidence: aiResponse.confidence },
  });

  await updateChatSessionTitle(chatSessionId, parsed.data.message, aiResponse.intent);

  const { getChatV3Stage } = await import('@/lib/chat-v3/stage');
  return NextResponse.json({ ok: true, userMessage, assistantMessage, response: aiResponse, messages: await getChatMessages(chatSessionId), cart: await getChatCart(chatSessionId), stage: await getChatV3Stage(chatSessionId) });
}
