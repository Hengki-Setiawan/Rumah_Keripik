import { NextResponse } from 'next/server';
import { validateCronRequest } from '@/lib/cron-auth';
import { buildRoutesForDate } from '@/lib/route-builder';
import { notifyCronFailure, touchCronHeartbeat } from '@/lib/cron-monitor';

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = validateCronRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const result = await buildRoutesForDate();
    await touchCronHeartbeat('route-build');
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    await notifyCronFailure('route-build', error);
    console.error('[ROUTE_BUILD_CRON]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}