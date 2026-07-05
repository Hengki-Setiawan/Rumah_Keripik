import { NextResponse } from 'next/server';
import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { produkKategori } from '@/lib/schema';
import { createSlug } from '@/lib/slug';

const CategorySchema = z.object({
  id_kategori: z.string().min(1).max(60).optional(),
  nama_kategori: z.string().min(2).max(120),
  slug: z.string().max(140).optional(),
  deskripsi: z.string().max(400).optional().nullable(),
  sort_order: z.number().int().min(0).default(0),
  is_active: z.number().int().min(0).max(1).default(1),
});

export async function GET() {
  const categories = await db.select().from(produkKategori).orderBy(asc(produkKategori.sort_order), asc(produkKategori.nama_kategori));
  return NextResponse.json({ ok: true, categories });
}

export async function POST(req: Request) {
  const parsed = CategorySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message || 'Kategori tidak valid' }, { status: 400 });
  const id = parsed.data.id_kategori || `KAT-${Date.now()}`;
  await db.insert(produkKategori).values({
    id_kategori: id,
    nama_kategori: parsed.data.nama_kategori,
    slug: parsed.data.slug || createSlug(parsed.data.nama_kategori),
    deskripsi: parsed.data.deskripsi || null,
    sort_order: parsed.data.sort_order,
    is_active: parsed.data.is_active,
  });
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null) as { id?: string; data?: unknown } | null;
  if (!body?.id) return NextResponse.json({ ok: false, error: 'ID kategori wajib ada' }, { status: 400 });
  const parsed = CategorySchema.partial().safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message || 'Kategori tidak valid' }, { status: 400 });
  await db.update(produkKategori).set({ ...parsed.data, updated_at: sql`(datetime('now', 'utc'))` }).where(eq(produkKategori.id_kategori, body.id));
  return NextResponse.json({ ok: true });
}
