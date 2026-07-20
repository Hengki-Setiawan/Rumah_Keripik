import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE_MB = 10;

const SignUploadSchema = z.object({
  folder: z.enum([
    'rumah-keripik/products',
    'rumah-keripik/products/variants',
    'rumah-keripik/qris',
    'rumah-keripik/payment-proofs',
  ]).default('rumah-keripik/products'),
  publicId: z.string().min(1).max(180).optional(),
  mimeType: z.string().optional(),
  fileSizeBytes: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  const parsed = SignUploadSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload upload tidak valid' }, { status: 400 });
  }

  if (parsed.data.folder === 'rumah-keripik/payment-proofs') {
    if (parsed.data.mimeType && !ALLOWED_MIME_TYPES.includes(parsed.data.mimeType)) {
      return NextResponse.json({
        ok: false,
        error: `Tipe file tidak didukung. Gunakan: ${ALLOWED_MIME_TYPES.join(', ')}`,
      }, { status: 400 });
    }
    if (parsed.data.fileSizeBytes && parsed.data.fileSizeBytes > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return NextResponse.json({
        ok: false,
        error: `Ukuran file maksimal ${MAX_FILE_SIZE_MB}MB`,
      }, { status: 400 });
    }
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
