import { NextResponse } from 'next/server';
import { queuePaymentAgingReminders } from '@/lib/payment-aging';
import { validateCronRequest } from '@/lib/cron-auth';

export async function GET(req: Request) {
  const auth = validateCronRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const aging = await queuePaymentAgingReminders();

  return NextResponse.json({ ok: true, aging });
}
