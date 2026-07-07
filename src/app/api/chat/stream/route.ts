import { NextResponse } from 'next/server';
import { getChatMessages } from '@/lib/chat-v3/messages';
import { getChatCart } from '@/lib/ai/tools/cart';
import { getCustomerContextForChat } from '@/lib/chat-v3/customer-context';
import { chatOwnershipErrorResponse, requireOwnedChatSession } from '@/lib/chat-v3/ownership';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const rate = checkRateLimit(`chat-stream:${getClientIp(req)}`, 20, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak koneksi stream.' }, { status: 429 });

  const { searchParams } = new URL(req.url);
  const chatSessionId = searchParams.get('chatSessionId') || '';
  if (!chatSessionId) return NextResponse.json({ ok: false, error: 'Chat session wajib ada' }, { status: 400 });

  try {
    await requireOwnedChatSession(chatSessionId);
  } catch (error) {
    const ownership = chatOwnershipErrorResponse(error);
    if (ownership) return NextResponse.json({ ok: false, error: ownership.error }, { status: ownership.status });
    throw error;
  }

  const encoder = new TextEncoder();
  let closed = false;
  let lastSignature = '';

  const stream = new ReadableStream({
    async start(controller) {
      async function push() {
        if (closed) return;
        const [messages, cart, customerContext] = await Promise.all([
          getChatMessages(chatSessionId),
          getChatCart(chatSessionId),
          getCustomerContextForChat(chatSessionId),
        ]);
        const signature = `${messages.at(-1)?.id || 'none'}:${messages.length}:${cart.itemCount}:${cart.total}`;
        if (signature !== lastSignature) {
          lastSignature = signature;
          controller.enqueue(encoder.encode(`event: chat_state\ndata: ${JSON.stringify({ ok: true, messages, cart, customerContext })}\n\n`));
        } else {
          controller.enqueue(encoder.encode(`event: ping\ndata: ${JSON.stringify({ ok: true, ts: Date.now() })}\n\n`));
        }
      }

      await push().catch((error) => controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Stream error' })}\n\n`)));
      const timer = setInterval(() => {
        push().catch((error) => controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Stream error' })}\n\n`)));
      }, 8_000);

      req.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(timer);
        controller.close();
      });
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
