import { NextResponse } from 'next/server';
import { validateCronRequest } from '@/lib/cron-auth';
import { processBackInStockNotifications, processLowStockAdminAlerts } from '@/lib/chat-v3/stock-watch';

export async function GET(req: Request) {
  const auth = validateCronRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const result = await processBackInStockNotifications().catch(() => ({ notified: 0 }));
  const lowStock = await processLowStockAdminAlerts().catch(() => ({ alerted: 0 }));
  return NextResponse.json({ ok: true, backInStockNotified: result.notified, lowStockAdminAlerts: lowStock.alerted });
}
