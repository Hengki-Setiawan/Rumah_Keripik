import { NextResponse } from 'next/server';
import { cleanupExpiredSessions } from '@/scripts/cleanup-expired';
import { validateCronRequest } from '@/lib/cron-auth';

export async function GET(req: Request) {
  const auth = validateCronRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const result = await cleanupExpiredSessions();
  return NextResponse.json({ ok: true, ...result });
}
