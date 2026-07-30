import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customerProfile } from '@/lib/schema';
import { getLoyaltyInfo } from '@/services/loyalty-service';
import { normalizePhoneNumber } from '@/lib/utils';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get('phone');
  if (!phone) return NextResponse.json({ ok: false, error: 'phone wajib' }, { status: 400 });

  try {
    const normalized = normalizePhoneNumber(phone);
    const [profile] = await db
      .select({ id: customerProfile.id_customer })
      .from(customerProfile)
      .where(eq(customerProfile.phone, normalized))
      .limit(1);
    if (!profile) return NextResponse.json({ ok: true, account: null, pointsHistory: [] });

    const info = await getLoyaltyInfo(profile.id);
    return NextResponse.json({ ok: true, ...info });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal' }, { status: 500 });
  }
}
