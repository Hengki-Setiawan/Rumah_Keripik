import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { expoPushTokens } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { sendPushNotification } from '@/lib/expo-push';
import { requireCourierAuth } from '@/lib/courier-auth';
import { z } from 'zod';

const SosSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  message: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  try {
    const courier = await requireCourierAuth(req);
    if (!courier) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = SosSchema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid' }, { status: 400 });
    }

    const { lat, lng, message } = body.data;

    console.error(`[SOS] COURIER ${courier.id} (${courier.name}) at ${lat},${lng}: ${message || 'No message'}`);

    try {
      const adminTokens = await db
        .select({ token: expoPushTokens.token })
        .from(expoPushTokens)
        .where(eq(expoPushTokens.courierId, -1));
      if (adminTokens.length > 0) {
        await sendPushNotification(
          adminTokens.map((t) => t.token),
          'SOS Darurat - Kurir',
          `${courier.name} (${courier.phone}) mengirim sinyal darurat! Lokasi: ${lat},${lng}`,
          { type: 'sos', courierId: String(courier.id) }
        );
      }
    } catch {
      // Silently fail if push fails.
    }

    return NextResponse.json({
      ok: true,
      message: 'Sinyal darurat diterima. Admin akan menghubungi Anda.',
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal' }, { status: 500 });
  }
}
