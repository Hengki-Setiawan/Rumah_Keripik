'use server';

import { db } from '@/lib/db';
import { zonaPengiriman } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const ZonaSchema = z.object({
  nama_zona: z.string().min(1, 'Nama zona wajib diisi'),
  lat_pusat: z.string().min(1, 'Latitude pusat wajib diisi'),
  lng_pusat: z.string().min(1, 'Longitude pusat wajib diisi'),
  radius_km: z.number().int().min(1),
  ongkir_min: z.number().int().min(0),
  ongkir_max: z.number().int().min(0),
});

type ZonaInput = z.infer<typeof ZonaSchema>;

export async function getAllZona() {
  try {
    return await db.select().from(zonaPengiriman).orderBy(desc(zonaPengiriman.id));
  } catch {
    return [];
  }
}

export async function tambahZona(data: ZonaInput) {
  try {
    const validated = ZonaSchema.parse(data);
    await db.insert(zonaPengiriman).values({ ...validated, is_active: 1 });
    revalidatePath('/master-data/zona-pengiriman');
    return { success: true, message: `Zona "${validated.nama_zona}" berhasil ditambahkan` };
  } catch (error) {
    return { success: false, message: error instanceof z.ZodError ? error.errors[0].message : 'Gagal tambah zona' };
  }
}

export async function updateZona(id: number, data: Partial<ZonaInput>) {
  try {
    await db.update(zonaPengiriman).set(data).where(eq(zonaPengiriman.id, id));
    revalidatePath('/master-data/zona-pengiriman');
    return { success: true, message: 'Zona berhasil diupdate' };
  } catch {
    return { success: false, message: 'Gagal update zona' };
  }
}

export async function nonaktifkanZona(id: number) {
  try {
    await db.update(zonaPengiriman).set({ is_active: 0 }).where(eq(zonaPengiriman.id, id));
    revalidatePath('/master-data/zona-pengiriman');
    return { success: true, message: 'Zona dinonaktifkan' };
  } catch {
    return { success: false, message: 'Gagal nonaktifkan zona' };
  }
}

export async function aktifkanZona(id: number) {
  try {
    await db.update(zonaPengiriman).set({ is_active: 1 }).where(eq(zonaPengiriman.id, id));
    revalidatePath('/master-data/zona-pengiriman');
    return { success: true, message: 'Zona diaktifkan' };
  } catch {
    return { success: false, message: 'Gagal aktifkan zona' };
  }
}
