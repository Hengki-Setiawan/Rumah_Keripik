import { NextResponse } from 'next/server';
import { validateCronRequest } from '@/lib/cron-auth';
import { autoDispatchReadyOrders } from '@/lib/auto-dispatch';
import { notifyCronFailure, touchCronHeartbeat } from '@/lib/cron-monitor';

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = validateCronRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const result = await autoDispatchReadyOrders();
    await touchCronHeartbeat('auto-dispatch');
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    await notifyCronFailure('auto-dispatch', error);
    console.error('[AUTO_DISPATCH_CRON]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}