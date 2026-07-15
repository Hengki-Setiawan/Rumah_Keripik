import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { paymentMethod } from '@/lib/schema';
import { buildPublicPaymentMethodOptions } from '@/lib/payments/payment-utils';
import { getCachedData, setCachedData } from '@/lib/redis-cache';

export async function GET() {
  const cacheKey = 'public_payment_methods';
  const cached = await getCachedData<any[]>(cacheKey);
  if (cached) {
    return NextResponse.json({ ok: true, methods: cached });
  }

  const methods = await db
    .select()
    .from(paymentMethod)
    .where(eq(paymentMethod.is_active, 1))
    .orderBy(asc(paymentMethod.sort_order), asc(paymentMethod.label));

  const resultMethods = buildPublicPaymentMethodOptions(methods);

  await setCachedData(cacheKey, resultMethods, 60);

  return NextResponse.json({
    ok: true,
    methods: resultMethods,
  });
}
