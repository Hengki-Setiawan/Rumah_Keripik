import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { zonaPengiriman } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';
import { z } from 'zod';

const ZoneSchema = z.object({
  nama_zona: z.string().min(1).max(120),
  lat_pusat: z.string().min(1),
  lng_pusat: z.string().min(1),
  radius_km: z.number().int().min(1).max(500).default(5),
  ongkir_min: z.number().int().min(0).max(100_000_000).default(0),
  ongkir_max: z.number().int().min(0).max(100_000_000).default(0),
  is_active: z.coerce.number().int().min(0).max(1).default(1),
});

export async function GET() {
  try {
    await requireAdminRole('courier:manage');
    const zones = await db.select().from(zonaPengiriman).orderBy(desc(zonaPengiriman.id));
    return NextResponse.json({
      ok: true,
      zones: zones.map((z) => ({
        id: z.id,
        nama_zona: z.nama_zona,
        lat_pusat: z.lat_pusat,
        lng_pusat: z.lng_pusat,
        radius_km: z.radius_km,
        ongkir_min: z.ongkir_min,
        ongkir_max: z.ongkir_max,
        total_order_bulan_ini: z.total_order_bulan_ini,
        is_active: z.is_active === 1,
      })),
    });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[ADMIN_ZONES_LIST]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminRole('courier:manage');
    const body = await request.json();
    const parsed = ZoneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid', details: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;
    const [inserted] = await db
      .insert(zonaPengiriman)
      .values({
        nama_zona: d.nama_zona,
        lat_pusat: d.lat_pusat,
        lng_pusat: d.lng_pusat,
        radius_km: d.radius_km,
        ongkir_min: d.ongkir_min,
        ongkir_max: d.ongkir_max,
        is_active: d.is_active,
      })
      .returning();
    return NextResponse.json({ ok: true, zone: inserted });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[ADMIN_ZONES_CREATE]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}