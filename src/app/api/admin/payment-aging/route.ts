import { NextResponse } from 'next/server';
import { getPaymentAgingOrders, queuePaymentAgingReminders } from '@/lib/payment-aging';

export async function GET() {
  return NextResponse.json({ ok: true, orders: await getPaymentAgingOrders() });
}

export async function POST() {
  return NextResponse.json({ ok: true, ...(await queuePaymentAgingReminders()) });
}
