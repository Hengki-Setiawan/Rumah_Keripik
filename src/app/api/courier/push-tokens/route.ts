import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { expoPushTokens } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { verifyCourierAuth } from '@/lib/courier/auth';

const PushTokenSchema = z.object({
  expoPushToken: z.string(),
  platform: z.enum(['android', 'ios']).optional(),
});

export async function POST(req: Request) {
  try {
    const auth = await verifyCourierAuth(req);
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = PushTokenSchema.parse(await req.json());

    const existing = await db.select()
      .from(expoPushTokens)
      .where(eq(expoPushTokens.token, body.expoPushToken))
      .limit(1);

    if (existing.length > 0) {
      await db.update(expoPushTokens).set({
        courierId: auth.courierId,
        platform: body.platform || existing[0].platform,
        lastActiveAt: new Date().toISOString(),
      }).where(eq(expoPushTokens.id, existing[0].id));
    } else {
      await db.insert(expoPushTokens).values({
        token: body.expoPushToken,
        courierId: auth.courierId,
        platform: body.platform || 'android',
      });
    }

    return NextResponse.json({ ok: true, data: { message: 'Push token registered' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal daftarkan token' }, { status: 500 });
  }
}
