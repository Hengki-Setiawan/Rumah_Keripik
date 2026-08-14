'use server';

import { db } from '@/lib/db';
import { produk } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { generateIdProduk } from '@/lib/id-generator';
import { revalidatePath } from 'next/cache';

const ProdukSchema = z.object({
  nama_produk: z.string().min(1, 'Nama produk wajib diisi'),
  deskripsi: z.string().optional(),
  harga_jual: z.number().int().min(1000, 'Harga minimal Rp1.000'),
  stok_gudang_utama: z.number().int().min(0, 'Stok tidak boleh negatif'),
  kategori_id: z.string().optional().nullable(),
  image_url: z.string().url().optional().nullable().or(z.literal('')),
  cloudinary_public_id: z.string().optional().nullable(),
  sort_order: z.number().int().min(0).optional(),
  is_featured: z.number().int().min(0).max(1).optional(),
  is_best_seller: z.number().int().min(0).max(1).optional(),
});

type ProdukInput = z.infer<typeof ProdukSchema>;

/**
 * Tambah produk baru
 */
export async function tambahProduk(data: ProdukInput) {
  try {
    const validated = ProdukSchema.parse(data);
    const id_produk = await generateIdProduk();

    await db.insert(produk).values({
      id_produk,
      ...validated,
      image_url: validated.image_url || null,
      is_active: 1,
    });

    revalidatePath('/master-data/produk');
    revalidatePath('/analitik');

    return {
      success: true,
      message: `Produk "${validated.nama_produk}" berhasil ditambahkan dengan ID ${id_produk}`,
      id_produk,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof z.ZodError ? error.errors[0].message : 'Gagal tambah produk',
    };
  }
}

/**
 * Update produk
 */
export async function updateProduk(id_produk: string, data: Partial<ProdukInput>) {
  try {
    const validated = ProdukSchema.partial().parse(data);

    await db
      .update(produk)
      .set({ ...validated, image_url: validated.image_url || null })
      .where(eq(produk.id_produk, id_produk));

    revalidatePath('/master-data/produk');
    revalidatePath('/analitik');

    return {
      success: true,
      message: 'Produk berhasil diupdate',
    };
  } catch {
    return {
      success: false,
      message: 'Gagal update produk',
    };
  }
}

export async function updateProdukLengkap(id_produk: string, data: Partial<ProdukInput>) {
  return updateProduk(id_produk, data);
}

/**
 * Nonaktifkan produk
 */
export async function nonaktifkanProduk(id_produk: string) {
  try {
    await db
      .update(produk)
      .set({ is_active: 0 })
      .where(eq(produk.id_produk, id_produk));

    revalidatePath('/dashboard/master-data/produk');

    return {
      success: true,
      message: 'Produk berhasil dinonaktifkan',
    };
  } catch {
    return {
      success: false,
      message: 'Gagal nonaktifkan produk',
    };
  }
}

/**
 * Aktifkan produk
 */
export async function aktifkanProduk(id_produk: string) {
  try {
    await db
      .update(produk)
      .set({ is_active: 1 })
      .where(eq(produk.id_produk, id_produk));

    revalidatePath('/dashboard/master-data/produk');

    return {
      success: true,
      message: 'Produk berhasil diaktifkan',
    };
  } catch {
    return {
      success: false,
      message: 'Gagal aktifkan produk',
    };
  }
}

/**
 * Ambil semua produk aktif
 */
export async function getAllProdukAktif() {
  try {
    const result = await db
      .select()
      .from(produk)
      .where(eq(produk.is_active, 1));

    return result;
  } catch (error) {
    console.error('Error fetch produk:', error);
    return [];
  }
}

/**
 * Ambil semua produk (aktif + nonaktif)
 */
export async function getAllProduk() {
  try {
    const result = await db.select().from(produk);
    return result;
  } catch (error) {
    console.error('Error fetch all produk:', error);
    return [];
  }
}
