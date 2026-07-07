import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { orderStatusHistory, transaksi } from '@/lib/schema';
import { isForbiddenAdminPermissionError, isUnauthorizedAdminError, requireAdminRole } from '@/lib/admin-actor';
import { notifyChatForOrderEvent } from '@/lib/chat-v3/order-notifications';
import { logAdminAudit } from '@/lib/admin-audit';

const StatusSchema = z.object({
  orderStatus: z.enum(['processing', 'shipping', 'completed', 'cancelled']),
  note: z.string().max(300).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const parsed = StatusSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Payload status tidak valid' }, { status: 400 });

  const [order] = await db.select().from(transaksi).where(eq(transaksi.id_transaksi, id)).limit(1);
  if (!order) return NextResponse.json({ ok: false, error: 'Order tidak ditemukan' }, { status: 404 });

  let actor = 'admin';
  try {
    const role = await requireAdminRole('order:update');
    actor = role.actor;
    await db.transaction(async (tx) => {
      await tx.update(transaksi).set({ order_status: parsed.data.orderStatus, updated_at: sql`(datetime('now', 'utc'))` }).where(eq(transaksi.id_transaksi, id));
      await tx.insert(orderStatusHistory).values({ id_transaksi: id, order_status: parsed.data.orderStatus, payment_status: order.payment_status, event_type: `ORDER_${parsed.data.orderStatus.toUpperCase()}`, actor, note: parsed.data.note });
    });
  } catch (error) {
    if (isUnauthorizedAdminError(error)) return NextResponse.json({ ok: false, error: 'Login admin diperlukan' }, { status: 401 });
    if (isForbiddenAdminPermissionError(error)) return NextResponse.json({ ok: false, error: 'Admin tidak punya izin update order' }, { status: 403 });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal update status order' }, { status: 409 });
  }

  await logAdminAudit({ actor, action: 'update_order_status', resourceType: 'order', resourceId: id, metadata: { orderStatus: parsed.data.orderStatus, note: parsed.data.note } });
  const event = parsed.data.orderStatus === 'shipping' ? 'order_shipping' : parsed.data.orderStatus === 'completed' ? 'order_completed' : parsed.data.orderStatus === 'cancelled' ? 'order_cancelled' : 'order_processing';
  await notifyChatForOrderEvent(id, event, { note: parsed.data.note });
  return NextResponse.json({ ok: true });
}
