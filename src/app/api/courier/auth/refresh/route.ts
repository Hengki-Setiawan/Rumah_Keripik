import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { courierSessions } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { verifyRefreshToken, signAccessToken, signRefreshToken, generateRefreshTokenId, sha256Hex } from '@/lib/auth-jwt';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const rate = await checkRateLimit(`courier-refresh:${getClientIp(req)}`, 30, 60_000);
    if (!rate.ok) {
      return NextResponse.json({ ok: false, error: 'Terlalu banyak percobaan refresh token' }, { status: 429 });
    }

    const { refreshToken: incomingToken } = await req.json();
    if (!incomingToken) {
      return NextResponse.json({ ok: false, error: 'Refresh token diperlukan' }, { status: 400 });
    }

    const payload = await verifyRefreshToken(incomingToken);
    if (!payload || payload.role !== 'courier') {
      return NextResponse.json({ ok: false, error: 'Refresh token tidak valid' }, { status: 401 });
    }

    // Cari sesi via hash token (baru). Fallback plaintext utk sesi legacy pra-migrasi.
    let [session] = await db
      .select()
      .from(courierSessions)
      .where(and(eq(courierSessions.token, sha256Hex(incomingToken)), eq(courierSessions.is_active, true)))
      .limit(1);

    if (!session) {
      [session] = await db
        .select()
        .from(courierSessions)
        .where(and(eq(courierSessions.token, incomingToken), eq(courierSessions.is_active, true)))
        .limit(1);
    }

    if (!session) {
      return NextResponse.json({ ok: false, error: 'Sesi tidak ditemukan atau sudah tidak aktif' }, { status: 401 });
    }

    if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: 'Sesi sudah kedaluwarsa' }, { status: 401 });
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
      .set({ token: sha256Hex(newRefreshToken), last_active_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })
      .where(eq(courierSessions.id, session.id));

    return NextResponse.json({ ok: true, accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal refresh token' }, { status: 500 });
  }
}
