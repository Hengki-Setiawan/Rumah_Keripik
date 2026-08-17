import { NextResponse } from 'next/server';
import { validateCronRequest } from '@/lib/cron-auth';
import { autoDispatchReadyOrders } from '@/lib/auto-dispatch';

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = validateCronRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const result = await autoDispatchReadyOrders();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[AUTO_DISPATCH_CRON]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}