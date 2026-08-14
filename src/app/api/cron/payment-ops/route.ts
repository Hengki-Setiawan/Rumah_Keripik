import { NextResponse } from 'next/server';
import { validateCronRequest } from '@/lib/cron-auth';

export async function GET(req: Request) {
  const auth = validateCronRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  return NextResponse.json({ ok: true, aging: { queued: 0 } });
}
