import { NextResponse } from 'next/server';
import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { produkVarian } from '@/lib/schema';

const VariantSchema = z.object({
  id_produk: z.string().min(1),
  id_varian: z.string().min(1).max(80).optional(),
  sku: z.string().max(80).optional().nullable(),
  nama_varian: z.string().min(1).max(120),
  rasa: z.string().max(80).optional().nullable(),
  ukuran: z.string().max(80).optional().nullable(),
  berat_gram: z.number().int().min(0).optional().nullable(),
  harga_jual: z.number().int().min(0),
  stok: z.number().int().min(0),
  cloudinary_public_id: z.string().max(255).optional().nullable(),
  image_url: z.string().url().optional().nullable().or(z.literal('')),
  sort_order: z.number().int().min(0).default(0),
  is_active: z.number().int().min(0).max(1).default(1),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const productId = url.searchParams.get('productId');
  const rows = productId
    ? await db.select().from(produkVarian).where(eq(produkVarian.id_produk, productId)).orderBy(asc(produkVarian.sort_order), asc(produkVarian.nama_varian))
    : await db.select().from(produkVarian).orderBy(asc(produkVarian.id_produk), asc(produkVarian.sort_order));
  return NextResponse.json({ ok: true, variants: rows });
}

export async function POST(req: Request) {
  const parsed = VariantSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message || 'Varian tidak valid' }, { status: 400 });
  const id = parsed.data.id_varian || `VAR-${Date.now()}`;
  await db.insert(produkVarian).values({ ...parsed.data, id_varian: id, image_url: parsed.data.image_url || null });
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null) as { id?: string; data?: unknown } | null;
  if (!body?.id) return NextResponse.json({ ok: false, error: 'ID varian wajib ada' }, { status: 400 });
  const parsed = VariantSchema.partial().safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.errors[0]?.message || 'Varian tidak valid' }, { status: 400 });
  await db.update(produkVarian).set({ ...parsed.data, image_url: parsed.data.image_url || undefined, updated_at: sql`(datetime('now', 'utc'))` }).where(eq(produkVarian.id_varian, body.id));
  return NextResponse.json({ ok: true });
}
