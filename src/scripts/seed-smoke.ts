import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  const { db } = await import('@/lib/db');
  const { botMenuItem, paymentMethod, produk, produkKategori, produkVarian } = await import('@/lib/schema');
  const now = new Date().toISOString();
  const categoryId = 'CAT-SMOKE-KERIPIK';
  const productId = 'KRP-SMOKE-001';
  const variantOriginal = 'VAR-SMOKE-ORI-100';
  const variantPedas = 'VAR-SMOKE-PEDAS-100';

  await db.insert(produkKategori).values({
    id_kategori: categoryId,
    nama_kategori: 'Smoke Test Keripik',
    slug: 'smoke-test-keripik',
    deskripsi: 'Kategori data dummy untuk smoke test flow publik.',
    sort_order: 900,
    is_active: 1,
  }).onConflictDoUpdate({ target: produkKategori.id_kategori, set: { is_active: 1, updated_at: now } });

  await db.insert(produk).values({
    id_produk: productId,
    nama_produk: 'Smoke Test Keripik Singkong',
    deskripsi: 'Produk dummy untuk pengujian order end-to-end.',
    harga_jual: 12000,
    stok_gudang_utama: 0,
    is_active: 1,
    slug: 'smoke-test-keripik-singkong',
    kategori_id: categoryId,
    berat_gram: 100,
    tags_json: JSON.stringify(['smoke-test']),
    sort_order: 900,
  }).onConflictDoUpdate({ target: produk.id_produk, set: { is_active: 1, kategori_id: categoryId, stok_gudang_utama: 0, updated_at: now } });

  await db.insert(produkVarian).values([
    { id_varian: variantOriginal, id_produk: productId, sku: 'SMOKE-ORI-100', nama_varian: 'Original 100g', rasa: 'Original', ukuran: '100g', berat_gram: 100, harga_jual: 12000, stok: 30, is_active: 1, sort_order: 1 },
    { id_varian: variantPedas, id_produk: productId, sku: 'SMOKE-PEDAS-100', nama_varian: 'Pedas 100g', rasa: 'Pedas', ukuran: '100g', berat_gram: 100, harga_jual: 13000, stok: 30, is_active: 1, sort_order: 2 },
  ]).onConflictDoNothing();

  await db.insert(paymentMethod).values([
    { id_payment_method: 'PM-SMOKE-BANK-BCA', type: 'bank_transfer', label: 'Smoke BCA Manual', account_name: 'Rumah Keripik Smoke', account_number: '000111222333', bank_name: 'BCA', note: 'Data dummy smoke test. Jangan gunakan untuk pembayaran real.', min_order_total: 0, max_order_total: null, sort_order: 900, is_active: 1 },
    { id_payment_method: 'PM-SMOKE-COD', type: 'cod', label: 'Smoke COD', note: 'COD dummy untuk smoke test.', min_order_total: 0, max_order_total: 1000000, sort_order: 901, is_active: 1 },
  ]).onConflictDoNothing();

  await db.insert(botMenuItem).values([
    { surface: 'public_ordering', label: 'Smoke order original', action: 'text_prompt', value: 'mau beli 1 original', sort_order: 900, is_active: 1 },
    { surface: 'public_ordering', label: 'Smoke order pedas', action: 'text_prompt', value: 'mau beli 1 pedas', sort_order: 901, is_active: 1 },
  ]).onConflictDoNothing();

  console.log(JSON.stringify({ ok: true, categoryId, productId, variants: [variantOriginal, variantPedas], paymentMethods: ['PM-SMOKE-BANK-BCA', 'PM-SMOKE-COD'] }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
