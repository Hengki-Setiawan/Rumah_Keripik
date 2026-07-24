import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { pelangganChatbot } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { signAccessToken, signRefreshToken, generateRefreshTokenId } from '@/lib/auth-jwt';

const MobileLoginSchema = z.object({
  phone: z.string().min(10).max(20).regex(/^62\d+/),
  pin: z.string().length(4).regex(/^\d+$/).optional(),
  register: z.boolean().optional().default(false),
  name: z.string().min(1).max(100).optional(),
});

export async function POST(req: Request) {
  try {
    const body = MobileLoginSchema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid', details: body.error.flatten() }, { status: 400 });
    }

    const { phone, pin, register, name } = body.data;

    const [existing] = await db.select().from(pelangganChatbot).where(eq(pelangganChatbot.no_wa_pelanggan, phone)).limit(1);

    if (register && !existing) {
      if (!name) {
        return NextResponse.json({ ok: false, error: 'Nama diperlukan untuk registrasi' }, { status: 400 });
      }
      const hashedPin = await bcrypt.hash(pin || phone.slice(-4), 10);
      await db.insert(pelangganChatbot).values({
        no_wa_pelanggan: phone,
        nama_pelanggan: name,
        pin_hash: hashedPin,
        channel: 'mobile',
      });
    } else if (register && existing) {
      return NextResponse.json({ ok: false, error: 'Nomor sudah terdaftar' }, { status: 409 });
    } else if (!existing) {
      return NextResponse.json({ ok: false, error: 'Nomor tidak terdaftar' }, { status: 401, statusText: 'Nomor tidak terdaftar' });
    }

    if (!pin) {
      if (!existing) {
        return NextResponse.json({ ok: true, needsPinSetup: true, message: 'Atur PIN 4 digit untuk login' });
      }
      return NextResponse.json({ ok: false, error: 'PIN diperlukan' }, { status: 400 });
    }

    const customer = existing || (await db.select().from(pelangganChatbot).where(eq(pelangganChatbot.no_wa_pelanggan, phone)).limit(1))[0];

    if (!customer.pin_hash) {
      const hashedPin = await bcrypt.hash(pin, 10);
      await db.update(pelangganChatbot).set({ pin_hash: hashedPin }).where(eq(pelangganChatbot.no_wa_pelanggan, phone));
    } else {
      const pinMatch = await bcrypt.compare(pin, customer.pin_hash);
      if (!pinMatch) {
        return NextResponse.json({ ok: false, error: 'PIN salah' }, { status: 401 });
      }
    }

    const sessionId = generateRefreshTokenId();
    const accessToken = await signAccessToken({
      sub: phone,
      role: 'mobile_customer',
      sessionId,
      name: customer.nama_pelanggan || name || undefined,
    });
    const refreshToken = await signRefreshToken({
      sub: phone,
      role: 'mobile_customer',
      sessionId,
      name: customer.nama_pelanggan || name || undefined,
    });

    return NextResponse.json({
      ok: true,
      accessToken,
      refreshToken,
      customer: {
        phone: customer.no_wa_pelanggan,
        name: customer.nama_pelanggan || name,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Gagal login' }, { status: 500 });
  }
}
