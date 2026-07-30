import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { trackingEvents, deliveryAssignment, couriers, transaksi } from '@/lib/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

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

        const assignmentRows = await db
          .select({ courierName: couriers.name, courierPhoto: couriers.photo_url, courierPhone: couriers.phone, platNo: couriers.plat_no, vehicle: couriers.vehicle, lastLat: couriers.last_lat, lastLng: couriers.last_lng })
          .from(deliveryAssignment)
          .innerJoin(couriers, eq(deliveryAssignment.kurir_id, couriers.id))
          .innerJoin(transaksi, eq(deliveryAssignment.id_transaksi, transaksi.id_transaksi))
          .where(and(eq(transaksi.id_transaksi, orderId), eq(deliveryAssignment.status, 'Dalam_Pengiriman')))
          .limit(1)
          .catch(() => []);
        const assignment = assignmentRows?.[0] || null;

        controller.enqueue(encoder.encode(`event: tracking\ndata: ${JSON.stringify({ ok: true, orderId, events, courier: assignment ? { name: assignment.courierName, photoUrl: assignment.courierPhoto, phone: assignment.courierPhone, platNo: assignment.platNo, vehicle: assignment.vehicle, lastLat: assignment.lastLat, lastLng: assignment.lastLng } : null })}\n\n`));
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
