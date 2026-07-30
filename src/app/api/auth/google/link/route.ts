import { NextRequest, NextResponse } from 'next/server';
import { db, customerIdentity, customerProfile, deviceIdentityLinks } from '@/lib/db';
import { auth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email || !session.user.googleId) {
      return NextResponse.json({ ok: false, error: 'Belum login Google' }, { status: 401 });
    }

    const googleId: string = session.user.googleId;
    const googleName = session.user.name || session.user.email;

    const deviceToken = req.cookies.get('rk_device_token')?.value;
    if (!deviceToken) {
      return NextResponse.json({ ok: false, error: 'Sesi pelanggan tidak ditemukan' }, { status: 400 });
    }

    const [link] = await db
      .select()
      .from(deviceIdentityLinks)
      .where(eq(deviceIdentityLinks.deviceTokenId, deviceToken))
      .limit(1);

    if (!link) {
      return NextResponse.json({ ok: false, error: 'Pelanggan tidak ditemukan. Buat pesanan dulu ya.' }, { status: 400 });
    }

    const customerId = link.customerId;

    const existingGoogle = await db
      .select()
      .from(customerIdentity)
      .where(
        and(
          eq(customerIdentity.provider, 'google'),
          eq(customerIdentity.external_id, googleId),
        )
      )
      .limit(1);

    if (existingGoogle.length > 0) {
      if (existingGoogle[0].id_customer !== customerId) {
        return NextResponse.json({ ok: false, error: 'Akun Google ini sudah terhubung ke pelanggan lain.' }, { status: 409 });
      }
      return NextResponse.json({ ok: true, message: 'Akun Google sudah terhubung.' });
    }

    const now = new Date().toISOString();
    await db.insert(customerIdentity).values({
      id_customer: customerId,
      provider: 'google',
      external_id: googleId,
      verified_at: now,
      created_at: now,
    });

    if (googleName) {
      const [cust] = await db
        .select({ nama: customerProfile.nama })
        .from(customerProfile)
        .where(eq(customerProfile.id_customer, customerId))
        .limit(1);

      if (!cust?.nama) {
        await db.update(customerProfile)
          .set({ nama: googleName, last_active_at: now })
          .where(eq(customerProfile.id_customer, customerId));
      }
    }

    return NextResponse.json({ ok: true, message: 'Akun Google berhasil dihubungkan!' });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
