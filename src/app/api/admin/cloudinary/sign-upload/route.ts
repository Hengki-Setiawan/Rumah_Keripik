import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const SignUploadSchema = z.object({
  folder: z.enum([
    'rumah-keripik/products',
    'rumah-keripik/products/variants',
    'rumah-keripik/qris',
    'rumah-keripik/payment-proofs',
  ]).default('rumah-keripik/products'),
  publicId: z.string().min(1).max(180).optional(),
});

export async function POST(req: Request) {
  const parsed = SignUploadSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload upload tidak valid' }, { status: 400 });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ ok: false, error: 'Konfigurasi Cloudinary belum lengkap' }, { status: 500 });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign: Record<string, string | number> = {
    folder: parsed.data.folder,
    timestamp,
  };

  if (parsed.data.publicId) {
    paramsToSign.public_id = parsed.data.publicId;
  }

  const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

  return NextResponse.json({
    ok: true,
    cloudName,
    apiKey,
    timestamp,
    signature,
    folder: parsed.data.folder,
    publicId: parsed.data.publicId ?? null,
  });
}
