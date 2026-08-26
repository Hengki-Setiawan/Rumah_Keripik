import { NextResponse } from 'next/server';
import { cleanupExpiredSessions } from '@/scripts/cleanup-expired';
import { cleanupExpiredIdempotencyKeys } from '@/lib/idempotency';
import { validateCronRequest } from '@/lib/cron-auth';
import { runCronJob } from '@/lib/cron-monitor';

export async function GET(req: Request) {
  const auth = validateCronRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const result = await runCronJob('cleanup', async () => {
    const [sessionResult, cleanedIdempotency] = await Promise.all([
      cleanupExpiredSessions(),
      cleanupExpiredIdempotencyKeys().then(() => true).catch(() => false),
    ]);
    return { ...sessionResult, cleanedIdempotency };
  });
  return NextResponse.json({ ok: true, ...result });
}
