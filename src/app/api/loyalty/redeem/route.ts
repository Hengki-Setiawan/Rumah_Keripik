import { NextResponse } from 'next/server';
import { z } from 'zod';
import { redeemPoints } from '@/services/loyalty-service';

const Schema = z.object({
  customerId: z.string().min(1),
  points: z.number().int().positive().min(10000),
  orderId: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Data tidak valid', details: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await redeemPoints(parsed.data.customerId, parsed.data.points, parsed.data.orderId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal redeem' }, { status: 400 });
  }
}
