import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { desc, eq, and, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customerAddress, webOrderSession } from '@/lib/schema';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { z } from 'zod';
import { normalizePhoneNumber } from '@/lib/utils';

const SESSION_COOKIE = 'rk_order_session';

const CreateAddressSchema = z.object({
  label: z.string().optional(),
  recipientName: z.string().min(1),
  phone: z.string().min(8),
  addressText: z.string().min(1),
  landmark: z.string().optional(),
  courierNote: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isDefault: z.boolean().optional(),
});

async function resolveCustomerId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [session] = await db
    .select({ id_customer: webOrderSession.id_customer })
    .from(webOrderSession)
    .where(eq(webOrderSession.anonymous_token, token))
    .limit(1);
  return session?.id_customer || null;
}

export async function GET(req: Request) {
  const rate = await checkRateLimit(`public-saved-addresses:${getClientIp(req)}`, 30, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak request. Coba lagi sebentar.' }, { status: 429 });

  const customerId = await resolveCustomerId();
  if (!customerId) return NextResponse.json({ ok: true, addresses: [] });

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
    .where(eq(customerAddress.id_customer, customerId))
    .orderBy(desc(customerAddress.last_used_at), desc(customerAddress.created_at))
    .limit(5);

  return NextResponse.json({ ok: true, addresses });
}

export async function POST(req: Request) {
  const rate = await checkRateLimit(`public-saved-addresses:${getClientIp(req)}`, 20, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak request.' }, { status: 429 });

  const customerId = await resolveCustomerId();
  if (!customerId) return NextResponse.json({ ok: false, error: 'Sesi tidak ditemukan.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreateAddressSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Data alamat tidak valid.' }, { status: 400 });

  if (parsed.data.isDefault) {
    await db.update(customerAddress).set({ is_default: 0, updated_at: sql`(datetime('now', 'utc'))` }).where(eq(customerAddress.id_customer, customerId));
  }

  const [address] = await db.insert(customerAddress).values({
    id_customer: customerId,
    label: parsed.data.label || 'Alamat',
    recipient_name: parsed.data.recipientName,
    phone: normalizePhoneNumber(parsed.data.phone),
    address_text: parsed.data.addressText,
    landmark: parsed.data.landmark || null,
    courier_note: parsed.data.courierNote || null,
    latitude: parsed.data.latitude ? String(parsed.data.latitude) : null,
    longitude: parsed.data.longitude ? String(parsed.data.longitude) : null,
    is_default: parsed.data.isDefault ? 1 : 0,
    location_source: parsed.data.latitude && parsed.data.longitude ? 'saved_address' as const : 'manual' as const,
    last_used_at: sql`(datetime('now', 'utc'))`,
    updated_at: sql`(datetime('now', 'utc'))`,
    created_at: sql`(datetime('now', 'utc'))`,
  }).returning();

  return NextResponse.json({ ok: true, address: { id: address.id_address } });
}
