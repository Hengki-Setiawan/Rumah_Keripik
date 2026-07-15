import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { paymentMethod } from '@/lib/schema';
import { buildPublicPaymentMethodOptions } from '@/lib/payments/payment-utils';

export async function getActivePaymentMethods() {
  const methods = await db
    .select()
    .from(paymentMethod)
    .where(eq(paymentMethod.is_active, 1))
    .orderBy(asc(paymentMethod.sort_order), asc(paymentMethod.label));

  return buildPublicPaymentMethodOptions(methods);
}
