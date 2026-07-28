import { NextRequest, NextResponse } from 'next/server';
import { db, otpRequests } from '@/lib/db';
import { eq, and, gt, desc } from 'drizzle-orm';
import crypto from 'crypto';

function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (!cleaned.startsWith('62') && cleaned.length >= 9) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, purpose = 'checkout_verification' } = body;

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json({ success: false, error: 'Nomor WhatsApp wajib diisi' }, { status: 400 });
    }

    const formattedPhone = normalizePhoneNumber(phoneNumber);
    if (formattedPhone.length < 10 || formattedPhone.length > 15) {
      return NextResponse.json({ success: false, error: 'Nomor WhatsApp tidak valid (minimal 10 digit)' }, { status: 400 });
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const recentRequests = await db
      .select()
      .from(otpRequests)
      .where(
        and(
          eq(otpRequests.phoneNumber, formattedPhone),
          gt(otpRequests.createdAt, tenMinutesAgo)
        )
      );

    if (recentRequests.length >= 3) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak permintaan OTP. Silakan tunggu 10 menit.' },
        { status: 429 }
      );
    }

    // Generate 6-digit OTP
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = crypto.createHash('sha256').update(rawOtp).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min expiry

    const id = `OTP-${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(otpRequests).values({
      id,
      phoneNumber: formattedPhone,
      codeHash,
      purpose,
      attempts: 0,
      maxAttempts: 3,
      expiresAt,
      consumedAt: null,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      createdAt: new Date().toISOString(),
    });

    // Send OTP via WhatsApp Gateway (Fonnte / Watzap / WA Cloud API)
    const fonnteToken = process.env.FONNTE_TOKEN;
    let gatewaySent = false;

    if (fonnteToken) {
      try {
        await fetch('https://api.fonnte.com/send', {
          method: 'POST',
          headers: {
            Authorization: fonnteToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            target: formattedPhone,
            message: `[Rumah Keripik] Kode OTP verifikasi pesanan Anda adalah: *${rawOtp}*. Berlaku selama 5 menit. JANGAN bagikan kode ini kepada siapapun.`,
          }),
        });
        gatewaySent = true;
      } catch (err) {
        console.warn('[WA Gateway Error]:', err);
      }
    }

    console.log(`[OTP GENERATED] Phone: ${formattedPhone} | Code: ${rawOtp} | Gateway: ${gatewaySent ? 'Sent' : 'Dev Mode'}`);

    return NextResponse.json({
      success: true,
      phoneNumber: formattedPhone,
      expiresInSeconds: 300,
      devModeOtp: process.env.NODE_ENV !== 'production' ? rawOtp : undefined,
    });
  } catch (error: any) {
    console.error('[OTP Request Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
