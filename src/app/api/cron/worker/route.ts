import { NextResponse } from 'next/server';
import { processWorkerBatch } from '@/lib/worker-runner';
import { validateCronRequest } from '@/lib/cron-auth';

export async function GET(req: Request) {
  const auth = validateCronRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const limit = Math.min(10, Math.max(1, Number(url.searchParams.get('limit') || 5)));
  const result = await processWorkerBatch(`cron-${Date.now()}`, limit);
  return NextResponse.json({ ok: true, ...result });
}
