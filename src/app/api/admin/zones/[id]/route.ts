import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { zonaPengiriman } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { requireAdminRole } from '@/lib/admin-actor';
import { z } from 'zod';

const ZoneSchema = z.object({
  nama_zona: z.string().min(1).max(120).optional(),
  lat_pusat: z.string().min(1).optional(),
  lng_pusat: z.string().min(1).optional(),
  radius_km: z.number().int().min(1).max(500).optional(),
  ongkir_min: z.number().int().min(0).max(100_000_000).optional(),
  ongkir_max: z.number().int().min(0).max(100_000_000).optional(),
  is_active: z.coerce.number().int().min(0).max(1).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminRole('courier:manage');
    const { id } = await params;
    const zoneId = parseInt(id, 10);
    if (isNaN(zoneId)) return NextResponse.json({ ok: false, error: 'ID tidak valid' }, { status: 400 });

    const body = await request.json();
    const parsed = ZoneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Data tidak valid', details: parsed.error.flatten() }, { status: 400 });
    }

    const [existing] = await db.select().from(zonaPengiriman).where(eq(zonaPengiriman.id, zoneId)).limit(1);
    if (!existing) return NextResponse.json({ ok: false, error: 'Zona tidak ditemukan' }, { status: 404 });

    await db.update(zonaPengiriman).set(parsed.data).where(eq(zonaPengiriman.id, zoneId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[ADMIN_ZONES_UPDATE]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminRole('courier:manage');
    const { id } = await params;
    const zoneId = parseInt(id, 10);
    if (isNaN(zoneId)) return NextResponse.json({ ok: false, error: 'ID tidak valid' }, { status: 400 });
    await db.delete(zonaPengiriman).where(eq(zonaPengiriman.id, zoneId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[ADMIN_ZONES_DELETE]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}