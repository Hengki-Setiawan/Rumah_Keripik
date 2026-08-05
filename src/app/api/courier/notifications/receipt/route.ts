import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notificationLog, notifications } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { requireCourierAuth } from '@/lib/courier-auth';

const ReceiptSchema = z.object({
  notificationId: z.string().optional(),
  opened: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const courier = await requireCourierAuth(req);
    if (!courier) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = ReceiptSchema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid', details: body.error.flatten() }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Tandai delivery_status device_confirmed/opened untuk semua log kurir ini.
    await db.update(notificationLog)
      .set({
        deliveryStatus: body.data.opened ? 'opened' : 'device_confirmed',
        deviceReceivedAt: now,
        deviceOpenedAt: body.data.opened ? now : undefined,
      })
      .where(and(
        eq(notificationLog.recipientType, 'courier'),
        eq(notificationLog.recipientId, String(courier.id)),
        eq(notificationLog.deliveryStatus, 'sent'),
      ));

    // Tandai is_read untuk inbox lama bila notificationId dikirim.
    if (body.data.notificationId) {
      const nid = Number(body.data.notificationId);
      if (Number.isInteger(nid)) {
        await db.update(notifications)
          .set({ isRead: true })
          .where(and(eq(notifications.id, nid), eq(notifications.courierId, courier.id)));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal update receipt' }, { status: 500 });
  }
}
