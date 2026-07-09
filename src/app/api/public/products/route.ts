import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { produk, produkKategori, produkVarian } from '@/lib/schema';
import { getProductImageUrl } from '@/lib/cloudinary-url';
import { formatRupiah } from '@/lib/utils';
import { getCachedData, setCachedData } from '@/lib/redis-cache';

export async function GET() {
  const cacheKey = 'public_products_list';
  const cached = await getCachedData<any[]>(cacheKey);
  if (cached) {
    return NextResponse.json({ ok: true, products: cached });
  }

  const rows = await db
    .select({
      id: produk.id_produk,
      name: produk.nama_produk,
      slug: produk.slug,
      description: produk.deskripsi,
      price: produk.harga_jual,
      stock: produk.stok_gudang_utama,
      cloudinaryPublicId: produk.cloudinary_public_id,
      imageUrl: produk.image_url,
      imageAlt: produk.image_alt,
      categoryId: produk.kategori_id,
      categoryName: produkKategori.nama_kategori,
      tagsJson: produk.tags_json,
      isFeatured: produk.is_featured,
      isBestSeller: produk.is_best_seller,
      sortOrder: produk.sort_order,
    })
    .from(produk)
    .leftJoin(produkKategori, eq(produk.kategori_id, produkKategori.id_kategori))
    .where(eq(produk.is_active, 1))
    .orderBy(asc(produk.sort_order), asc(produk.nama_produk));

  const products = rows.map((item) => ({
    id: item.id,
    name: item.name,
    slug: item.slug,
    description: item.description,
    price: item.price,
    priceLabel: formatRupiah(item.price),
    stock: item.stock,
    stockLabel: item.stock > 0 ? `${item.stock} tersedia` : 'Stok habis',
    imageUrl: item.cloudinaryPublicId ? getProductImageUrl(item.cloudinaryPublicId) : item.imageUrl,
    imageAlt: item.imageAlt || item.name,
    cloudinaryPublicId: item.cloudinaryPublicId,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    tags: parseTags(item.tagsJson),
    isFeatured: Boolean(item.isFeatured),
    isBestSeller: Boolean(item.isBestSeller),
    sortOrder: item.sortOrder,
    actions: [
      { label: 'Pilih Produk', action: 'select_product', value: item.id },
    ],
  }));

  const variants = await db
    .select({
      id: produkVarian.id_varian,
      productId: produkVarian.id_produk,
      sku: produkVarian.sku,
      name: produkVarian.nama_varian,
      rasa: produkVarian.rasa,
      ukuran: produkVarian.ukuran,
      weightGram: produkVarian.berat_gram,
      price: produkVarian.harga_jual,
      stock: produkVarian.stok,
      imageUrl: produkVarian.image_url,
      cloudinaryPublicId: produkVarian.cloudinary_public_id,
      sortOrder: produkVarian.sort_order,
    })
    .from(produkVarian)
    .where(eq(produkVarian.is_active, 1))
    .orderBy(asc(produkVarian.sort_order), asc(produkVarian.nama_varian));

  const variantsByProduct = new Map<string, typeof variants>();
  for (const variant of variants) {
    const list = variantsByProduct.get(variant.productId) || [];
    list.push(variant);
    variantsByProduct.set(variant.productId, list);
  }

  const resultProducts = products.map((product) => ({
    ...product,
    variants: (variantsByProduct.get(product.id) || []).map((variant) => ({
      ...variant,
      priceLabel: formatRupiah(variant.price),
      stockLabel: variant.stock > 0 ? `${variant.stock} tersedia` : 'Stok habis',
      imageUrl: variant.cloudinaryPublicId ? getProductImageUrl(variant.cloudinaryPublicId) : variant.imageUrl,
    })),
  }));

  await setCachedData(cacheKey, resultProducts, 60);

  return NextResponse.json({
    ok: true,
    products: resultProducts,
  });
}

function parseTags(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
