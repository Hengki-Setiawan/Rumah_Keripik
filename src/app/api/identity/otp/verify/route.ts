import { NextResponse } from 'next/server';
import { z } from 'zod';
import { completeOtpIdentity } from '@/lib/identity/complete';
import { getOrCreateIdentityFlow } from '@/lib/identity/flow';

const VerifySchema = z.object({
  phone: z.string().min(8).max(24),
  code: z.string().length(6).regex(/^\d+$/),
  chatSessionId: z.string().min(1),
  displayName: z.string().min(2).max(80).optional(),
  purpose: z.enum(['login', 'register', 'checkout_verification']).default('checkout_verification'),
});

export async function POST(req: Request) {
  const parsed = VerifySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Data verifikasi tidak valid' }, { status: 400 });

  const { phone, code, chatSessionId, displayName, purpose } = parsed.data;

  const result = await completeOtpIdentity({ phone, code, chatSessionId, displayName, purpose });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error, reason: result.reason }, { status: 422 });

  const flow = await getOrCreateIdentityFlow(chatSessionId);
  return NextResponse.json({
    ok: true,
    customerId: result.customerId,
    isNew: result.isNew,
    phone: result.phone,
    displayName: flow?.displayName ?? displayName ?? null,
  });
}