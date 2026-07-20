import { db } from '@/lib/db';
import { produk } from '@/lib/schema';
import { getProductPlaceholder } from '@/lib/product-placeholders';
import { v2 as cloudinary } from 'cloudinary';
import { eq } from 'drizzle-orm';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadProductImages() {
  const products = await db.select().from(produk).where(eq(produk.is_active, 1));
  let uploaded = 0;
  let skipped = 0;

  for (const product of products) {
    if (product.cloudinary_public_id) {
      console.log(`[SKIP] ${product.nama_produk} — sudah punya gambar`);
      skipped++;
      continue;
    }

    const placeholder = getProductPlaceholder({
      nama_produk: product.nama_produk,
      deskripsi: product.deskripsi,
    });

    const publicId = `rumah-keripik/products/${product.id_produk.toLowerCase()}`;

    try {
      const result = await cloudinary.uploader.upload(placeholder.url, {
        public_id: publicId,
        folder: 'rumah-keripik/products',
        overwrite: true,
      });

      await db.update(produk).set({
        cloudinary_public_id: result.public_id,
        image_url: result.secure_url,
        image_alt: product.nama_produk,
      }).where(eq(produk.id_produk, product.id_produk));

      console.log(`[OK] ${product.nama_produk} → ${result.secure_url}`);
      uploaded++;
    } catch (error) {
      console.error(`[FAIL] ${product.nama_produk}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`\nSelesai! ${uploaded} uploaded, ${skipped} skipped`);
}

uploadProductImages().catch(console.error);
