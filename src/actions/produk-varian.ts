'use server';

import { asc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { produkMedia, produkVarian } from '@/lib/schema';
import { ProductMediaSchema, VariantSchema, type ProductMediaInput, type VariantInput } from '@/lib/validators/catalog';

function generateVariantId() {
  return `VAR-${Date.now().toString(36).toUpperCase()}`;
}

export async function getVarianProduk(id_produk: string) {
  return db
    .select()
    .from(produkVarian)
    .where(eq(produkVarian.id_produk, id_produk))
    .orderBy(asc(produkVarian.sort_order), asc(produkVarian.nama_varian));
}

export async function tambahVarianProduk(data: VariantInput) {
  try {
    const validated = VariantSchema.parse(data);
    const id_varian = validated.id_varian || generateVariantId();

    await db.insert(produkVarian).values({
      ...validated,
      id_varian,
      sku: validated.sku ?? null,
      rasa: validated.rasa ?? null,
      ukuran: validated.ukuran ?? null,
      berat_gram: validated.berat_gram ?? null,
      cloudinary_public_id: validated.cloudinary_public_id ?? null,
      image_url: validated.image_url ?? null,
    });

    revalidatePath('/master-data/produk');
    return { success: true, id_varian };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Gagal tambah varian' };
  }
}

export async function updateVarianProduk(id_varian: string, data: Partial<VariantInput>) {
  try {
    const validated = VariantSchema.partial().parse(data);
    await db.update(produkVarian).set(validated).where(eq(produkVarian.id_varian, id_varian));
    revalidatePath('/master-data/produk');
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Gagal update varian' };
  }
}

export async function tambahMediaProduk(data: ProductMediaInput) {
  try {
    const validated = ProductMediaSchema.parse(data);
    await db.insert(produkMedia).values({
      ...validated,
      id_varian: validated.id_varian ?? null,
      secure_url: validated.secure_url ?? null,
      alt_text: validated.alt_text ?? null,
    });

    revalidatePath('/master-data/produk');
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Gagal tambah media produk' };
  }
}
