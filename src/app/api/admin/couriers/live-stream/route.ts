import { db } from '@/lib/db';
import { couriers } from '@/lib/schema';
import { desc } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PUSH_INTERVAL_MS = 5_000;
const MAX_AGE_MS = 55_000;

export async function GET(req: Request) {
  try {
    await requireAdminRole('courier:manage');
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION')) {
      return new Response('Unauthorized', { status: 403 });
    }
    return new Response('Internal Server Error', { status: 500 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  async function fetchSnapshot() {
    const rows = await db
      .select()
      .from(couriers)
      .orderBy(desc(couriers.created_at));

    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      vehicle: c.vehicle,
      last_lat: c.last_lat,
      last_lng: c.last_lng,
      last_location_at: c.last_location_at,
      is_active: c.is_active === 1,
    }));
  }

  const stream = new ReadableStream({
    async start(controller) {
      async function push() {
        if (closed) return;
        const couriers = await fetchSnapshot().catch(() => []);
        controller.enqueue(encoder.encode(`event: live\ndata: ${JSON.stringify({ ok: true, couriers })}\n\n`));
      }

      await push().catch(() => {});
      const timer = setInterval(() => push().catch(() => {}), PUSH_INTERVAL_MS);

      const timeout = setTimeout(() => {
        closed = true;
        clearInterval(timer);
        controller.close();
      }, MAX_AGE_MS);

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
