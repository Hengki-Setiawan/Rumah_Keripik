import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getClientIp } from '@/lib/rate-limit';
import { requestOtp, type OtpPurpose } from '@/lib/identity/otp';

const RequestSchema = z.object({
  phone: z.string().min(8).max(24),
  purpose: z.enum(['login', 'register', 'checkout_verification']).default('checkout_verification'),
});

export async function POST(req: Request) {
  const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Nomor WhatsApp tidak valid' }, { status: 400 });

  const ip = getClientIp(req);
  const result = await requestOtp({ phone: parsed.data.phone, purpose: parsed.data.purpose as OtpPurpose, ip });

  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 422 });

  const body: Record<string, unknown> = {
    ok: true,
    sent: result.sent,
    phone: result.phone,
    phoneMasked: result.phoneMasked,
    phoneFound: result.phoneFound,
  };
  if (result.sent) {
    body.expiresInSeconds = result.expiresInSeconds;
  } else {
    body.reason = result.reason;
    if (result.reason === 'already_registered') {
      body.displayName = result.displayName ?? null;
      body.customerId = result.idCustomer ?? null;
    }
  }
  return NextResponse.json(body);
}