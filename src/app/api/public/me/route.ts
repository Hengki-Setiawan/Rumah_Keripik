import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { customerAddress, customerProfile, customerSessions, transaksi, webOrderSession } from '@/lib/schema';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { CUSTOMER_SESSION_COOKIE, hashCustomerSessionToken } from '@/lib/chat-v3/session';
import { normalizePhoneNumber } from '@/lib/utils';

const ORDER_SESSION_COOKIE = 'rk_order_session';

const ProfileSchema = z.object({
  nama: z.string().min(2).max(80),
  phone: z.string().min(8).max(24),
  email: z.string().email().max(120).optional().or(z.literal('')),
});

const AddressSchema = z.object({
  id: z.number().int().optional(),
  label: z.string().max(50).optional(),
  recipientName: z.string().min(2).max(80),
  phone: z.string().min(8).max(24),
  addressText: z.string().min(8).max(500),
  landmark: z.string().max(200).optional(),
  courierNote: z.string().max(240).optional(),
  latitude: z.string().max(40).optional(),
  longitude: z.string().max(40).optional(),
  isDefault: z.boolean().optional(),
});

const DeleteSchema = z.object({
  addressId: z.number().int(),
});

async function resolvePortalContext() {
  const cookieStore = await cookies();
  const customerToken = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  const orderToken = cookieStore.get(ORDER_SESSION_COOKIE)?.value;

  let customerId: string | null = null;
  let orderSessionId: string | null = null;
  let anonymousLabel: string | null = null;

  if (customerToken) {
    const tokenHash = hashCustomerSessionToken(customerToken);
    const [customerSession] = await db
      .select()
      .from(customerSessions)
      .where(and(eq(customerSessions.sessionTokenHash, tokenHash), isNull(customerSessions.revokedAt)))
      .limit(1);
    if (customerSession) {
      customerId = customerSession.customerId || null;
      anonymousLabel = customerSession.anonymousLabel || null;
    }
  }

  if (orderToken) {
    const [webSession] = await db
      .select()
      .from(webOrderSession)
      .where(eq(webOrderSession.anonymous_token, orderToken))
      .limit(1);
    if (webSession) {
      customerId = customerId || webSession.id_customer || null;
      orderSessionId = webSession.id_session;
    }
  }

  return { customerId, orderSessionId, anonymousLabel };
}

export async function GET(req: Request) {
  const rate = await checkRateLimit(`public-me:${getClientIp(req)}`, 60, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak request. Coba lagi sebentar.' }, { status: 429 });

  const context = await resolvePortalContext();
  if (!context.customerId && !context.orderSessionId) {
    return NextResponse.json({ ok: true, profile: null, addresses: [], orders: [], anonymousLabel: context.anonymousLabel });
  }

  const [profile, addresses, orders] = await Promise.all([
    context.customerId
      ? db.select().from(customerProfile).where(eq(customerProfile.id_customer, context.customerId)).limit(1).then((rows) => rows[0] || null)
      : Promise.resolve(null),
    context.customerId
      ? db
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
            isDefault: customerAddress.is_default,
            updatedAt: customerAddress.updated_at,
          })
          .from(customerAddress)
          .where(eq(customerAddress.id_customer, context.customerId))
          .orderBy(desc(customerAddress.is_default), desc(customerAddress.updated_at))
      : Promise.resolve([]),
    db
      .select({
        idTransaksi: transaksi.id_transaksi,
        kodePesanan: transaksi.kode_pesanan,
        totalBayar: transaksi.total_bayar,
        statusPembayaran: transaksi.status_pembayaran,
        paymentStatus: transaksi.payment_status,
        orderStatus: transaksi.order_status,
        paymentMethod: transaksi.payment_method,
        namaPenerima: transaksi.nama_penerima,
        phonePenerima: transaksi.no_hp_penerima,
        alamatPenerima: transaksi.alamat_penerima,
        waktuSimpan: transaksi.waktu_simpan,
        updatedAt: transaksi.updated_at,
        statusToken: transaksi.status_token,
      })
      .from(transaksi)
      .where(
        context.customerId && context.orderSessionId
          ? or(eq(transaksi.id_customer, context.customerId), eq(transaksi.id_session, context.orderSessionId))!
          : context.customerId
            ? eq(transaksi.id_customer, context.customerId)
            : eq(transaksi.id_session, context.orderSessionId!)
      )
      .orderBy(desc(transaksi.waktu_simpan))
      .limit(20),
  ]);

  return NextResponse.json({
    ok: true,
    anonymousLabel: context.anonymousLabel,
    profile: profile
      ? {
          id: profile.id_customer,
          nama: profile.nama,
          phone: profile.phone,
          email: profile.email,
        }
      : null,
    addresses,
    orders,
  });
}

export async function PATCH(req: Request) {
  const rate = await checkRateLimit(`public-me-patch:${getClientIp(req)}`, 30, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak update. Coba lagi sebentar.' }, { status: 429 });

  const context = await resolvePortalContext();
  if (!context.customerId) return NextResponse.json({ ok: false, error: 'Profil pelanggan belum tersedia.' }, { status: 401 });

  const parsed = ProfileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Data profil tidak valid.' }, { status: 400 });

  await db
    .update(customerProfile)
    .set({
      nama: parsed.data.nama,
      phone: normalizePhoneNumber(parsed.data.phone),
      email: parsed.data.email || null,
      last_active_at: sql`(datetime('now', 'utc'))`,
    })
    .where(eq(customerProfile.id_customer, context.customerId));

  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const rate = await checkRateLimit(`public-me-post:${getClientIp(req)}`, 30, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak update alamat. Coba lagi sebentar.' }, { status: 429 });

  const context = await resolvePortalContext();
  if (!context.customerId) return NextResponse.json({ ok: false, error: 'Alamat pelanggan belum tersedia.' }, { status: 401 });

  const parsed = AddressSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Data alamat tidak valid.' }, { status: 400 });

  await db.transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.update(customerAddress).set({ is_default: 0, updated_at: sql`(datetime('now', 'utc'))` }).where(eq(customerAddress.id_customer, context.customerId!));
    }

    const payload = {
      label: parsed.data.label || 'Alamat',
      recipient_name: parsed.data.recipientName,
      phone: normalizePhoneNumber(parsed.data.phone),
      address_text: parsed.data.addressText,
      landmark: parsed.data.landmark || null,
      courier_note: parsed.data.courierNote || null,
      latitude: parsed.data.latitude || null,
      longitude: parsed.data.longitude || null,
      is_default: parsed.data.isDefault ? 1 : 0,
      location_source: parsed.data.latitude && parsed.data.longitude ? 'saved_address' as const : 'manual' as const,
      last_used_at: sql`(datetime('now', 'utc'))`,
      updated_at: sql`(datetime('now', 'utc'))`,
    };

    if (parsed.data.id) {
      await tx
        .update(customerAddress)
        .set(payload)
        .where(and(eq(customerAddress.id_address, parsed.data.id), eq(customerAddress.id_customer, context.customerId!)));
    } else {
      await tx.insert(customerAddress).values({
        id_customer: context.customerId!,
        ...payload,
      });
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const rate = await checkRateLimit(`public-me-delete:${getClientIp(req)}`, 20, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak hapus alamat. Coba lagi sebentar.' }, { status: 429 });

  const context = await resolvePortalContext();
  if (!context.customerId) return NextResponse.json({ ok: false, error: 'Alamat pelanggan belum tersedia.' }, { status: 401 });

  const parsed = DeleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Permintaan hapus alamat tidak valid.' }, { status: 400 });

  await db
    .delete(customerAddress)
    .where(and(eq(customerAddress.id_address, parsed.data.addressId), eq(customerAddress.id_customer, context.customerId)));

  return NextResponse.json({ ok: true });
}
