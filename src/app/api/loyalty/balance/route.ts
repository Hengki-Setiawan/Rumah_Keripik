import { NextResponse } from 'next/server';
import { getLoyaltyInfo } from '@/services/loyalty-service';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get('customerId');
  if (!customerId) return NextResponse.json({ ok: false, error: 'customerId wajib' }, { status: 400 });

  try {
    const info = await getLoyaltyInfo(customerId);
    return NextResponse.json({ ok: true, ...info });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal' }, { status: 500 });
  }
}
