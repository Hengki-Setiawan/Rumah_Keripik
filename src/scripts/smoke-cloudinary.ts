import { config } from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

config({ path: '.env.local' });

async function main() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error('Cloudinary env belum lengkap');
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

  const { db } = await import('@/lib/db');
  const { paymentMethod } = await import('@/lib/schema');
  const { eq } = await import('drizzle-orm');

  const dataUri = 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="#fff7df"/><rect x="40" y="40" width="240" height="240" fill="none" stroke="#8d4b00" stroke-width="16"/><text x="160" y="170" text-anchor="middle" font-size="32" font-family="Arial" fill="#241306">SMOKE QRIS</text></svg>`).toString('base64');
  const upload = await cloudinary.uploader.upload(dataUri, {
    folder: 'rumah-keripik/smoke',
    public_id: `qris-smoke-${Date.now()}`,
    overwrite: false,
    resource_type: 'image',
  });

  await db.update(paymentMethod).set({ qris_public_id: upload.public_id, qris_image_url: upload.secure_url }).where(eq(paymentMethod.id_payment_method, 'PM-SMOKE-BANK-BCA'));

  console.log(JSON.stringify({ ok: true, publicId: upload.public_id, secureUrl: upload.secure_url }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
