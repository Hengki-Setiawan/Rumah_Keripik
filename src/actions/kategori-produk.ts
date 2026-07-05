'use server';

import { asc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { produkKategori } from '@/lib/schema';
import { CategorySchema, type CategoryInput } from '@/lib/validators/catalog';
import { createSlug } from '@/lib/slug';

function generateCategoryId() {
  return `KAT-${Date.now().toString(36).toUpperCase()}`;
}

export async function getKategoriProduk(includeInactive = false) {
  const query = db
    .select()
    .from(produkKategori)
    .orderBy(asc(produkKategori.sort_order), asc(produkKategori.nama_kategori));

  if (includeInactive) return query;

  return db
    .select()
    .from(produkKategori)
    .where(eq(produkKategori.is_active, 1))
    .orderBy(asc(produkKategori.sort_order), asc(produkKategori.nama_kategori));
}

export async function tambahKategoriProduk(data: CategoryInput) {
  try {
    const validated = CategorySchema.parse(data);
    const id_kategori = validated.id_kategori || generateCategoryId();
    const slug = validated.slug || createSlug(validated.nama_kategori);

    await db.insert(produkKategori).values({
      id_kategori,
      nama_kategori: validated.nama_kategori,
      slug,
      deskripsi: validated.deskripsi ?? null,
      sort_order: validated.sort_order,
      is_active: validated.is_active,
    });

    revalidatePath('/master-data/produk');
    return { success: true, id_kategori };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Gagal tambah kategori' };
  }
}

export async function updateKategoriProduk(id_kategori: string, data: Partial<CategoryInput>) {
  try {
    const validated = CategorySchema.partial().parse(data);

    await db
      .update(produkKategori)
      .set({
        ...validated,
        ...(validated.nama_kategori && !validated.slug ? { slug: createSlug(validated.nama_kategori) } : {}),
      })
      .where(eq(produkKategori.id_kategori, id_kategori));

    revalidatePath('/master-data/produk');
    return { success: true };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Gagal update kategori' };
  }
}
