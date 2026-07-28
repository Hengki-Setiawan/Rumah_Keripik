import { NextRequest, NextResponse } from 'next/server';
import { db, deviceTokens } from '@/lib/db';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const existingToken = req.cookies.get('rk_device_token')?.value;

    if (existingToken) {
      const [device] = await db
        .select()
        .from(deviceTokens)
        .where(eq(deviceTokens.id, existingToken))
        .limit(1);

      if (device) {
        return NextResponse.json({
          success: true,
          deviceToken: device.id,
          displayName: device.displayName,
        });
      }
    }

    const newToken = crypto.randomUUID();
    await db.insert(deviceTokens).values({
      id: newToken,
      displayName: null,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    });

    const res = NextResponse.json({
      success: true,
      deviceToken: newToken,
      displayName: null,
    });

    res.cookies.set('rk_device_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 90 * 24 * 60 * 60, // 90 days
    });

    return res;
  } catch (error: any) {
    console.error('[Session API Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { displayName } = body;
    const deviceToken = req.cookies.get('rk_device_token')?.value;

    if (!deviceToken) {
      return NextResponse.json({ success: false, error: 'Device token tidak ditemukan' }, { status: 400 });
    }

    await db
      .update(deviceTokens)
      .set({
        displayName: displayName || null,
        lastSeenAt: new Date().toISOString(),
      })
      .where(eq(deviceTokens.id, deviceToken));

    return NextResponse.json({
      success: true,
      deviceToken,
      displayName,
    });
  } catch (error: any) {
    console.error('[Session Update Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
