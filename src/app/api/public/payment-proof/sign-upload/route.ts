import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { transaksi } from '@/lib/schema';

const SignProofSchema = z.object({
  orderId: z.string().min(1),
  statusToken: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  const rate = checkRateLimit(`public-proof-sign:${getClientIp(req)}`, 12, 60_000);
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Terlalu banyak percobaan upload. Coba lagi sebentar.' }, { status: 429 });

  const parsed = SignProofSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Order ID wajib diisi' }, { status: 400 });

  const [order] = await db
    .select({ id_transaksi: transaksi.id_transaksi, payment_status: transaksi.payment_status, status_token: transaksi.status_token })
    .from(transaksi)
    .where(eq(transaksi.id_transaksi, parsed.data.orderId))
    .limit(1);
  if (!order) return NextResponse.json({ ok: false, error: 'Pesanan tidak ditemukan' }, { status: 404 });
  if (!order.status_token || order.status_token !== parsed.data.statusToken) return NextResponse.json({ ok: false, error: 'Token pesanan tidak valid' }, { status: 403 });
  if (order.payment_status === 'verified') return NextResponse.json({ ok: false, error: 'Pembayaran pesanan ini sudah terverifikasi' }, { status: 409 });

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ ok: false, error: 'Konfigurasi Cloudinary belum lengkap' }, { status: 500 });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder = `rumah-keripik/payment-proofs/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const publicId = `${parsed.data.orderId}_${timestamp}`;
  const paramsToSign = { folder, public_id: publicId, timestamp };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

  return NextResponse.json({ ok: true, cloudName, apiKey, timestamp, signature, folder, publicId });
}
