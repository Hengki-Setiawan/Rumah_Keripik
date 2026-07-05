import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { produkKategori } from '@/lib/schema';

export async function GET() {
  const categories = await db
    .select({
      id: produkKategori.id_kategori,
      name: produkKategori.nama_kategori,
      slug: produkKategori.slug,
      description: produkKategori.deskripsi,
      sortOrder: produkKategori.sort_order,
    })
    .from(produkKategori)
    .where(eq(produkKategori.is_active, 1))
    .orderBy(asc(produkKategori.sort_order), asc(produkKategori.nama_kategori));

  return NextResponse.json({ ok: true, categories });
}
