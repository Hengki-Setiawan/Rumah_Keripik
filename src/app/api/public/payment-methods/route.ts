import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { paymentMethod } from '@/lib/schema';
import { buildPaymentInstructionPayload } from '@/lib/payments/payment-utils';

export async function GET() {
  const methods = await db
    .select()
    .from(paymentMethod)
    .where(eq(paymentMethod.is_active, 1))
    .orderBy(asc(paymentMethod.sort_order), asc(paymentMethod.label));

  return NextResponse.json({
    ok: true,
    methods: methods.map((method) => ({
      id: method.id_payment_method,
      ...buildPaymentInstructionPayload(method),
      minOrderTotal: method.min_order_total,
      maxOrderTotal: method.max_order_total,
    })),
  });
}
