import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { couriers, notifications } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';
import { sendCourierPushNotification } from '@/lib/expo-push';
import { z } from 'zod';

const BroadcastSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  courierIds: z.array(z.number()).optional(),
});

export async function POST(request: Request) {
  try {
    await requireAdminRole('courier:manage');

    const body = await request.json();
    const parsed = BroadcastSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid', details: parsed.error.flatten() }, { status: 400 });
    }

    const activeCouriers = await db
      .select()
      .from(couriers)
      .where(eq(couriers.is_active, 1));

    let targets = activeCouriers;
    if (parsed.data.courierIds && parsed.data.courierIds.length > 0) {
      const idSet = new Set(parsed.data.courierIds);
      targets = activeCouriers.filter((c) => idSet.has(c.id));
    }

    if (targets.length === 0) {
      return NextResponse.json({ ok: false, error: 'Tidak ada kurir yang cocok' }, { status: 404 });
    }

    const now = new Date().toISOString();

    await db.insert(notifications).values(
      targets.map((c) => ({
        courierId: c.id,
        title: parsed.data.title,
        body: parsed.data.body,
        type: 'broadcast' as const,
        createdAt: now,
      }))
    );

    let sent = 0;
    for (const c of targets) {
      try {
        await sendCourierPushNotification(c.id, parsed.data.title, parsed.data.body, {
          type: 'broadcast',
          ts: String(Date.now()),
        });
        sent += 1;
      } catch {
        // push gagal (token kadaluarsa dll.), notifikasi in-app tetap tersimpan
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Broadcast terkirim ke ${targets.length} kurir`,
      data: { total_target: targets.length, push_sent: sent },
    });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[ADMIN_NOTIFICATIONS_BROADCAST]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}