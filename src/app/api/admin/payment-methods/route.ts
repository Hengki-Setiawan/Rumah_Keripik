import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { paymentMethod } from '@/lib/schema';
import { PaymentMethodSchema } from '@/lib/validators/payment';
import { generatePaymentMethodId } from '@/lib/payments/payment-utils';

export async function GET() {
  const methods = await db
    .select()
    .from(paymentMethod)
    .orderBy(asc(paymentMethod.sort_order), asc(paymentMethod.label));

  return NextResponse.json({ ok: true, methods });
}

export async function POST(req: Request) {
  const parsed = PaymentMethodSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message || 'Data metode pembayaran tidak valid' }, { status: 400 });
  }

  const id = generatePaymentMethodId();
  await db.insert(paymentMethod).values({
    id_payment_method: id,
    ...parsed.data,
  });

  return NextResponse.json({ ok: true, id });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null) as { id?: string; data?: unknown } | null;
  if (!body?.id) return NextResponse.json({ ok: false, error: 'ID metode pembayaran wajib diisi' }, { status: 400 });

  const parsed = PaymentMethodSchema.partial().safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message || 'Data metode pembayaran tidak valid' }, { status: 400 });
  }

  await db.update(paymentMethod).set(parsed.data).where(eq(paymentMethod.id_payment_method, body.id));
  return NextResponse.json({ ok: true });
}
