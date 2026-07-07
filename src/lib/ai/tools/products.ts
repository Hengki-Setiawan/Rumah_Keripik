import { asc, eq, like, or, and, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { produk, produkKategori, produkVarian } from '@/lib/schema';
import { getProductImageUrl } from '@/lib/cloudinary-url';
import { formatRupiah } from '@/lib/utils';

export async function searchProducts(query?: string, productIds?: string[]) {
  const base = db
    .select({
      id: produk.id_produk,
      name: produk.nama_produk,
      description: produk.deskripsi,
      price: produk.harga_jual,
      stock: produk.stok_gudang_utama,
      imageUrl: produk.image_url,
      cloudinaryPublicId: produk.cloudinary_public_id,
      categoryId: produk.kategori_id,
      categoryName: produkKategori.nama_kategori,
      tagsJson: produk.tags_json,
      isFeatured: produk.is_featured,
      isBestSeller: produk.is_best_seller,
      sortOrder: produk.sort_order,
    })
    .from(produk)
    .leftJoin(produkKategori, eq(produk.kategori_id, produkKategori.id_kategori));

  const lower = query?.trim().toLowerCase();
  const where = productIds?.length
    ? and(eq(produk.is_active, 1), inArray(produk.id_produk, productIds))
    : lower
      ? and(eq(produk.is_active, 1), or(like(produk.nama_produk, `%${lower}%`), like(produk.deskripsi, `%${lower}%`), like(produk.tags_json, `%${lower}%`)))
      : eq(produk.is_active, 1);

  const rows = await base.where(where).orderBy(asc(produk.sort_order), asc(produk.nama_produk)).limit(12);
  const ids = rows.map((row) => row.id);
  const variants = ids.length
    ? await db
        .select({
          id: produkVarian.id_varian,
          productId: produkVarian.id_produk,
          name: produkVarian.nama_varian,
          price: produkVarian.harga_jual,
          stock: produkVarian.stok,
          imageUrl: produkVarian.image_url,
          cloudinaryPublicId: produkVarian.cloudinary_public_id,
        })
        .from(produkVarian)
        .where(and(eq(produkVarian.is_active, 1), inArray(produkVarian.id_produk, ids)))
        .orderBy(asc(produkVarian.sort_order), asc(produkVarian.nama_varian))
    : [];

  const variantsByProduct = new Map<string, typeof variants>();
  for (const variant of variants) {
    const list = variantsByProduct.get(variant.productId) || [];
    list.push(variant);
    variantsByProduct.set(variant.productId, list);
  }

  return rows.map((row) => ({
    ...row,
    priceLabel: formatRupiah(row.price),
    imageUrl: row.cloudinaryPublicId ? getProductImageUrl(row.cloudinaryPublicId) : row.imageUrl,
    tags: parseTags(row.tagsJson),
    isFeatured: Boolean(row.isFeatured),
    isBestSeller: Boolean(row.isBestSeller),
    variants: (variantsByProduct.get(row.id) || []).map((variant) => ({
      ...variant,
      priceLabel: formatRupiah(variant.price),
      imageUrl: variant.cloudinaryPublicId ? getProductImageUrl(variant.cloudinaryPublicId) : variant.imageUrl,
    })),
  }));
}

export async function recommendProducts(message: string, memory: Array<{ key: string; value: string }> = []) {
  const lower = `${message} ${memory.map((item) => item.value).join(' ')}`.toLowerCase();
  const products = await searchProducts();
  const budgetMatch = lower.match(/(?:budget|harga|maks|di bawah|dibawah)\s*(\d{2,3})(?:\s*ribu|k)?/);
  const budget = budgetMatch ? Number(budgetMatch[1]) * 1000 : null;

  const scored = products
    .filter((product) => product.stock > 0 || product.variants.some((variant) => variant.stock > 0))
    .map((product) => {
      const haystack = `${product.name} ${product.description || ''} ${product.tags.join(' ')}`.toLowerCase();
      const prices = [product.price, ...product.variants.map((variant) => variant.price)];
      const lowestPrice = Math.min(...prices.filter((price) => price > 0));
      let score = 1;
      if (product.isFeatured) score += 1;
      if (product.isBestSeller) score += 1;
      if (lower.includes('pedas') && !lower.includes('tidak') && (haystack.includes('pedas') || haystack.includes('spicy'))) score += 5;
      if ((lower.includes('tidak pedas') || lower.includes('anak') || lower.includes('original')) && !haystack.includes('pedas')) score += 5;
      if ((lower.includes('keluarga') || lower.includes('oleh') || lower.includes('besar')) && (haystack.includes('paket') || haystack.includes('mix') || haystack.includes('besar'))) score += 4;
      if ((lower.includes('hemat') || lower.includes('murah')) && lowestPrice <= 30000) score += 3;
      if (budget && lowestPrice <= budget) score += 3;
      if (memory.some((item) => haystack.includes(item.value.toLowerCase()))) score += 2;
      return { product, score };
    })
    .sort((a, b) => b.score - a.score || a.product.sortOrder - b.product.sortOrder);

  return scored.slice(0, 4).map((item) => item.product);
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
