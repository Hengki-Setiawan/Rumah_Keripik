import { NextResponse } from 'next/server';
import { z } from 'zod';
import { processReferral } from '@/services/loyalty-service';

const Schema = z.object({
  code: z.string().min(1),
  refereeCustomerId: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Data tidak valid', details: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await processReferral(parsed.data.code, parsed.data.refereeCustomerId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal proses referral' }, { status: 400 });
  }
}
