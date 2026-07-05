import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customerAddress, webOrderSession } from '@/lib/schema';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const SESSION_COOKIE = 'rk_order_session';

export async function GET(req: Request) {
  const rate = checkRateLimit(`public-saved-addresses:${getClientIp(req)}`, 30, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak request. Coba lagi sebentar.' }, { status: 429 });

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ ok: true, addresses: [] });

  const [session] = await db
    .select({ id_customer: webOrderSession.id_customer })
    .from(webOrderSession)
    .where(eq(webOrderSession.anonymous_token, token))
    .limit(1);

  if (!session?.id_customer) return NextResponse.json({ ok: true, addresses: [] });

  const addresses = await db
    .select({
      id: customerAddress.id_address,
      label: customerAddress.label,
      recipientName: customerAddress.recipient_name,
      phone: customerAddress.phone,
      addressText: customerAddress.address_text,
      landmark: customerAddress.landmark,
      courierNote: customerAddress.courier_note,
      latitude: customerAddress.latitude,
      longitude: customerAddress.longitude,
      lastUsedAt: customerAddress.last_used_at,
    })
    .from(customerAddress)
    .where(eq(customerAddress.id_customer, session.id_customer))
    .orderBy(desc(customerAddress.last_used_at), desc(customerAddress.created_at))
    .limit(5);

  return NextResponse.json({ ok: true, addresses });
}
