'use server';

import { db } from '@/lib/db';
import { warungRetail } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { generateIdWarung } from '@/lib/id-generator';
import { revalidatePath } from 'next/cache';

const WarungSchema = z.object({
  nama_warung: z.string().min(1, 'Nama warung wajib diisi'),
  pemilik: z.string().optional(),
  no_wa_warung: z.string().optional(),
  alamat: z.string().min(1, 'Alamat wajib diisi'),
  tipe_kemitraan: z.enum(['Reseller', 'Agent', 'Dropshipper']),
  min_order_grosir: z.number().int().min(0),
});

type WarungInput = z.infer<typeof WarungSchema>;

/**
 * Tambah warung retail baru
 */
export async function tambahWarung(data: WarungInput) {
  try {
    const validated = WarungSchema.parse(data);
    const id_warung = await generateIdWarung();

    await db.insert(warungRetail).values({
      id_warung,
      ...validated,
      is_active: 1,
    });

    revalidatePath('/master-data/warung');

    return {
      success: true,
      message: `Warung "${validated.nama_warung}" berhasil ditambahkan dengan ID ${id_warung}`,
      id_warung,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof z.ZodError ? error.errors[0].message : 'Gagal tambah warung',
    };
  }
}

/**
 * Update warung
 */
export async function updateWarung(id_warung: string, data: Partial<WarungInput>) {
  try {
    const validated = WarungSchema.partial().parse(data);

    await db
      .update(warungRetail)
      .set(validated)
      .where(eq(warungRetail.id_warung, id_warung));

    revalidatePath('/master-data/warung');

    return {
      success: true,
      message: 'Warung berhasil diupdate',
    };
  } catch (error) {
    return {
      success: false,
      message: 'Gagal update warung',
    };
  }
}

/**
 * Nonaktifkan warung
 */
export async function nonaktifkanWarung(id_warung: string) {
  try {
    await db
      .update(warungRetail)
      .set({ is_active: 0 })
      .where(eq(warungRetail.id_warung, id_warung));

    revalidatePath('/master-data/warung');

    return {
      success: true,
      message: 'Warung berhasil dinonaktifkan',
    };
  } catch (error) {
    return {
      success: false,
      message: 'Gagal nonaktifkan warung',
    };
  }
}

/**
 * Aktifkan warung
 */
export async function aktifkanWarung(id_warung: string) {
  try {
    await db
      .update(warungRetail)
      .set({ is_active: 1 })
      .where(eq(warungRetail.id_warung, id_warung));

    revalidatePath('/master-data/warung');

    return {
      success: true,
      message: 'Warung berhasil diaktifkan',
    };
  } catch (error) {
    return {
      success: false,
      message: 'Gagal aktifkan warung',
    };
  }
}

/**
 * Ambil semua warung aktif
 */
export async function getAllWarungAktif() {
  try {
    const result = await db
      .select()
      .from(warungRetail)
      .where(eq(warungRetail.is_active, 1));

    return result;
  } catch (error) {
    console.error('Error fetch warung aktif:', error);
    return [];
  }
}

/**
 * Ambil semua warung (aktif + nonaktif) dengan pagination
 */
export async function getAllWarung(page: number = 1, limit: number = 50) {
  try {
    const offset = (page - 1) * limit;
    return await db
      .select()
      .from(warungRetail)
      .orderBy(desc(warungRetail.waktu_daftar))
      .limit(limit)
      .offset(offset);
  } catch (error) {
    console.error('Error fetch all warung:', error);
    return [];
  }
}

/**
 * Ambil satu warung berdasarkan ID
 */
export async function getWarungById(id_warung: string) {
  try {
    const result = await db
      .select()
      .from(warungRetail)
      .where(eq(warungRetail.id_warung, id_warung));

    return result[0] || null;
  } catch (error) {
    console.error('Error fetch warung by id:', error);
    return null;
  }
}
