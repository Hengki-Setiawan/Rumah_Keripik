import { NextResponse } from 'next/server';
import { count, gte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orderEvents } from '@/lib/schema';

const FUNNEL_EVENTS = [
  'WEB_SESSION_CREATED',
  'WEB_PRODUCTS_REQUESTED',
  'WEB_PRODUCT_SELECTED',
  'WEB_CART_UPDATED',
  'WEB_CHECKOUT_STARTED',
  'WEB_CUSTOMER_INFO_SUBMITTED',
  'WEB_ADDRESS_SUBMITTED',
  'WEB_PAYMENT_METHOD_SELECTED',
  'WEB_ORDER_CREATED',
  'WEB_PAYMENT_PROOF_UPLOADED',
] as const;

export async function GET() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const rows = await db
    .select({ eventType: orderEvents.event_type, total: count() })
    .from(orderEvents)
    .where(gte(orderEvents.created_at, since))
    .groupBy(orderEvents.event_type);

  const counts = new Map(rows.filter((row) => row.eventType.startsWith('WEB_')).map((row) => [row.eventType, Number(row.total)]));
  const funnel = FUNNEL_EVENTS.map((eventType, index) => {
    const count = counts.get(eventType) ?? 0;
    const previousCount = index > 0 ? counts.get(FUNNEL_EVENTS[index - 1]) ?? 0 : count;
    return {
      eventType,
      count,
      conversionFromPrevious: previousCount > 0 ? Math.round((count / previousCount) * 1000) / 10 : null,
    };
  });

  return NextResponse.json({ ok: true, windowDays: 30, funnel });
}
