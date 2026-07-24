import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courierSessions } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { verifyRefreshToken, signAccessToken, signRefreshToken, generateRefreshTokenId } from '@/lib/auth-jwt';

export async function POST(req: Request) {
  try {
    const { refreshToken: incomingToken } = await req.json();
    if (!incomingToken) {
      return NextResponse.json({ ok: false, error: 'Refresh token diperlukan' }, { status: 400 });
    }

    const payload = await verifyRefreshToken(incomingToken);
    if (!payload || payload.role !== 'courier') {
      return NextResponse.json({ ok: false, error: 'Refresh token tidak valid' }, { status: 401 });
    }

    const [session] = await db
      .select()
      .from(courierSessions)
      .where(and(eq(courierSessions.token, incomingToken), eq(courierSessions.is_active, true)))
      .limit(1);

    if (!session) {
      return NextResponse.json({ ok: false, error: 'Sesi tidak ditemukan atau sudah tidak aktif' }, { status: 401 });
    }

    const newSessionId = generateRefreshTokenId();
    const newAccessToken = await signAccessToken({
      sub: payload.sub,
      role: 'courier',
      sessionId: newSessionId,
      name: payload.name,
    });
    const newRefreshToken = await signRefreshToken({
      sub: payload.sub,
      role: 'courier',
      sessionId: newSessionId,
      name: payload.name,
    });

    await db
      .update(courierSessions)
      .set({ token: newRefreshToken, last_active_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })
      .where(eq(courierSessions.id, session.id));

    return NextResponse.json({ ok: true, accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal refresh token' }, { status: 500 });
  }
}
