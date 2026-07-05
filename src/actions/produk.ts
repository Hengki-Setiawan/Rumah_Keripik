'use server';

import { db } from '@/lib/db';
import { produk } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';
import { detailTransaksi } from '@/lib/schema';
import { z } from 'zod';
import { generateIdProduk } from '@/lib/id-generator';
import { formatRupiah } from '@/lib/utils';
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

    const result = await db.insert(produk).values({
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
  } catch (error) {
    return {
      success: false,
      message: 'Gagal update produk',
    };
  }
}

/**
 * Update stok produk
 */
export async function updateStok(id_produk: string, stok_baru: number) {
  try {
    if (stok_baru < 0) {
      return {
        success: false,
        message: 'Stok tidak boleh negatif',
      };
    }

    await db
      .update(produk)
      .set({ stok_gudang_utama: stok_baru })
      .where(eq(produk.id_produk, id_produk));

    revalidatePath('/master-data/produk');
    revalidatePath('/analitik');

    return {
      success: true,
      message: 'Stok berhasil diupdate',
    };
  } catch (error) {
    return {
      success: false,
      message: 'Gagal update stok',
    };
  }
}

/**
 * Update harga produk
 */
export async function updateHarga(id_produk: string, harga_jual: number) {
  try {
    if (harga_jual < 1000) {
      return {
        success: false,
        message: 'Harga minimal Rp1.000',
      };
    }

    await db
      .update(produk)
      .set({ harga_jual })
      .where(eq(produk.id_produk, id_produk));

    revalidatePath('/master-data/produk');
    revalidatePath('/analitik');

    return {
      success: true,
      message: 'Harga berhasil diupdate ke ' + formatRupiah(harga_jual),
    };
  } catch (error) {
    return {
      success: false,
      message: 'Gagal update harga',
    };
  }
}

export async function updateProdukLengkap(id_produk: string, data: Partial<ProdukInput>) {
  return updateProduk(id_produk, data);
}

/**
 * Update harga massal berdasarkan persentase
 * @param persentase - misal 10 berarti naik 10%, -5 berarti turun 5%
 */
export async function updateHargaMasal(persentase: number) {
  try {
    const result = await db
      .update(produk)
      .set({
        harga_jual: sql`CAST(ROUND(${produk.harga_jual} * (1.0 + ${persentase} / 100.0)) AS INTEGER)`,
      })
      .where(eq(produk.is_active, 1));

    revalidatePath('/master-data/produk');

    return {
      success: true,
      message: `Harga semua produk aktif berhasil diubah ${persentase >= 0 ? 'naik' : 'turun'} ${Math.abs(persentase)}%`,
    };
  } catch (error) {
    console.error('Error update harga masal:', error);
    return { success: false, message: 'Gagal update harga massal' };
  }
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
  } catch (error) {
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
  } catch (error) {
    return {
      success: false,
      message: 'Gagal aktifkan produk',
    };
  }
}

/**
 * Hapus produk (hanya jika tidak memiliki riwayat transaksi)
 */
export async function hapusProduk(id_produk: string) {
  try {
    const related = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(detailTransaksi)
      .where(eq(detailTransaksi.id_produk, id_produk));

    if (related[0].count > 0) {
      return {
        success: false,
        message: `Produk tidak bisa dihapus karena memiliki ${related[0].count} riwayat transaksi. Nonaktifkan saja.`,
      };
    }

    await db.delete(produk).where(eq(produk.id_produk, id_produk));
    revalidatePath('/master-data/produk');
    return { success: true, message: 'Produk berhasil dihapus' };
  } catch (error) {
    return { success: false, message: 'Gagal hapus produk' };
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

/**
 * Ambil satu produk berdasarkan ID
 */
export async function getProdukById(id_produk: string) {
  try {
    const result = await db
      .select()
      .from(produk)
      .where(eq(produk.id_produk, id_produk));

    return result[0] || null;
  } catch (error) {
    console.error('Error fetch produk by id:', error);
    return null;
  }
}
