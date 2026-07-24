import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { trackingEvents } from '@/lib/schema';
import { eq, desc, and, gt, sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      async function push() {
        if (closed) return;
        const events = await db
          .select()
          .from(trackingEvents)
          .where(eq(trackingEvents.orderId, orderId))
          .orderBy(desc(trackingEvents.createdAt))
          .limit(20);
        controller.enqueue(encoder.encode(`event: tracking\ndata: ${JSON.stringify({ ok: true, orderId, events })}\n\n`));
      }

      await push().catch(() => {});
      const timer = setInterval(() => push().catch(() => {}), 5_000);

      const timeout = setTimeout(() => {
        closed = true;
        clearInterval(timer);
        controller.close();
      }, 55_000);

      req.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(timer);
        clearTimeout(timeout);
        controller.close();
      });
    },
    cancel() { closed = true; },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
