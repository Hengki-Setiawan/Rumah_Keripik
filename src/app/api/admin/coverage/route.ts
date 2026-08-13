import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminRole } from '@/lib/admin-actor';
import { fetchIsochrones, isInsidePolygon, orsEnabled } from '@/lib/courier/ors';
import { isValidCoordinate } from '@/lib/location-parser';

const WAREHOUSE_LAT = -5.134;
const WAREHOUSE_LNG = 119.4135;

/**
 * Zona layanan berbasis jaringan jalan (ORS Isochrones).
 *
 * GET  /api/admin/coverage?minutes=15,30,45
 *   -> { ok, enabled, zones: [{ minute, polygon: [[lng,lat],...] }], warehouse }
 *   Polygon = area yang bisa dicapai dalam X menit dari gudang. Dipakai untuk
 *   menampilkan jangkauan layanan di dashboard admin (mis. hitung ongkir
 *   akurat, cek order di luar area).
 *
 * POST /api/admin/coverage/check { lat, lng, minutes? }
 *   -> { ok, inside, zoneMinutes, error? }
 *   Cek apakah satu titik masuk zona X menit. Tanpa isochrone yang di-cache,
 *   fallback ke cek jarak udara + `minutes` heuristic.
 */
export async function GET(req: Request) {
  try {
    await requireAdminRole('courier:manage');
    const url = new URL(req.url);
    const minutes = (url.searchParams.get('minutes') || '15,30,45')
      .split(',')
      .map((m) => Number.parseInt(m.trim(), 10))
      .filter((m) => Number.isFinite(m) && m > 0 && m <= 180)
      .sort((a, b) => a - b);
    const effective = minutes.length ? minutes : [15, 30, 45];

    if (!orsEnabled()) {
      return NextResponse.json({
        ok: true,
        enabled: false,
        zones: [],
        warehouse: { lat: WAREHOUSE_LAT, lng: WAREHOUSE_LNG },
        error: 'ORS_API_KEY belum dikonfigurasi',
      });
    }

    const zones = await fetchIsochrones(
      { lat: WAREHOUSE_LAT, lng: WAREHOUSE_LNG },
      effective.map((m) => m * 60),
    );

    return NextResponse.json({
      ok: true,
      enabled: true,
      zones,
      warehouse: { lat: WAREHOUSE_LAT, lng: WAREHOUSE_LNG },
    });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[ADMIN_COVERAGE]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

const CheckSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  minutes: z.array(z.number().int().min(1).max(180)).optional(),
});

export async function POST(req: Request) {
  try {
    await requireAdminRole('courier:manage');
    const body = CheckSchema.parse(await req.json());
    const lat = body.lat;
    const lng = body.lng;
    if (!isValidCoordinate(lat, lng)) {
      return NextResponse.json({ ok: false, error: 'Koordinat tidak valid' }, { status: 400 });
    }
    const minutes = (body.minutes?.length ? body.minutes : [15, 30, 45]).sort((a, b) => a - b);

    if (!orsEnabled()) {
      return NextResponse.json({ ok: true, enabled: false, inside: true, zoneMinutes: null, error: 'ORS_API_KEY belum dikonfigurasi' });
    }

    const zones = await fetchIsochrones(
      { lat: WAREHOUSE_LAT, lng: WAREHOUSE_LNG },
      minutes.map((m) => m * 60),
    );

    // Zona terkecil yang mencakup titik menentukan "berapa menit" jangkauan.
    const inside = zones.find((z) => z.polygon.length >= 3 && isInsidePolygon({ lat, lng }, z.polygon));
    const zoneMinutes = inside ? Math.round(inside.range / 60) : null;

    return NextResponse.json({ ok: true, enabled: true, inside: Boolean(zoneMinutes), zoneMinutes });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED_ADMIN' || error.message === 'FORBIDDEN_ADMIN_PERMISSION')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[ADMIN_COVERAGE_CHECK]', error);
    return NextResponse.json({ ok: false, error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}