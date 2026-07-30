import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notifications, expoPushTokens } from '@/lib/schema';
import { isNotNull } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';
import { broadcastToAllCouriers } from '@/lib/expo-push';
import { z } from 'zod';

const BroadcastSchema = z.object({
  title: z.string(),
  body: z.string(),
  target: z.enum(['all', 'active', 'idle']).optional(),
});

export async function POST(req: Request) {
  try {
    await requireAdminRole('order:update');

    const body = BroadcastSchema.parse(await req.json());
    const tokens = await db.select({ courierId: expoPushTokens.courierId }).from(expoPushTokens).where(isNotNull(expoPushTokens.courierId));

    const courierIds = [...new Set(tokens.map((t) => t.courierId).filter(Boolean))] as number[];

    let pushResult = { sent: 0, failed: 0 };
    if (courierIds.length > 0) {
      for (const courierId of courierIds) {
        await db.insert(notifications).values({
          courierId,
          title: body.title,
          body: body.body,
          type: 'broadcast',
          isRead: false,
        });
      }

      pushResult = await broadcastToAllCouriers(body.title, body.body, { type: 'broadcast' });
    }

    return NextResponse.json({
      ok: true,
      data: {
        stored: courierIds.length,
        pushSent: pushResult.sent,
        pushFailed: pushResult.failed,
      },
    });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal broadcast' }, { status: 500 });
  }
}
