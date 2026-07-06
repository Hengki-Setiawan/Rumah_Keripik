import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  const { db } = await import('@/lib/db');
  const { eq, inArray, like, sql } = await import('drizzle-orm');
  const { botMenuItem, paymentMethod, produk, produkKategori, produkVarian } = await import('@/lib/schema');

  const productIds = ['KRP-SMOKE-001'];
  const variantIds = ['VAR-SMOKE-ORI-100', 'VAR-SMOKE-PEDAS-100'];
  const categoryIds = ['CAT-SMOKE-KERIPIK'];
  const paymentMethodIds = ['PM-SMOKE-BANK-BCA', 'PM-SMOKE-COD'];

  const variants = await db
    .update(produkVarian)
    .set({ is_active: 0, updated_at: sql`(datetime('now', 'utc'))` })
    .where(inArray(produkVarian.id_varian, variantIds));

  const products = await db
    .update(produk)
    .set({ is_active: 0, updated_at: sql`(datetime('now', 'utc'))` })
    .where(inArray(produk.id_produk, productIds));

  const categories = await db
    .update(produkKategori)
    .set({ is_active: 0, updated_at: sql`(datetime('now', 'utc'))` })
    .where(inArray(produkKategori.id_kategori, categoryIds));

  const payments = await db
    .update(paymentMethod)
    .set({ is_active: 0, updated_at: sql`(datetime('now', 'utc'))` })
    .where(inArray(paymentMethod.id_payment_method, paymentMethodIds));

  const promptsOriginal = await db
    .update(botMenuItem)
    .set({ is_active: 0, updated_at: sql`(datetime('now', 'utc'))` })
    .where(eq(botMenuItem.label, 'Smoke order original'));

  const promptsPedas = await db
    .update(botMenuItem)
    .set({ is_active: 0, updated_at: sql`(datetime('now', 'utc'))` })
    .where(eq(botMenuItem.label, 'Smoke order pedas'));

  const promptsLike = await db
    .update(botMenuItem)
    .set({ is_active: 0, updated_at: sql`(datetime('now', 'utc'))` })
    .where(like(botMenuItem.label, 'Smoke%'));

  console.log(JSON.stringify({
    ok: true,
    disabled: {
      variants: variants.rowsAffected,
      products: products.rowsAffected,
      categories: categories.rowsAffected,
      paymentMethods: payments.rowsAffected,
      promptsOriginal: promptsOriginal.rowsAffected,
      promptsPedas: promptsPedas.rowsAffected,
      promptsLike: promptsLike.rowsAffected,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
