import { NextResponse } from 'next/server';
import { createClient, type Row } from '@libsql/client';

export const dynamic = 'force-dynamic';

const R_EARTH_KM = 6371;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R_EARTH_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET() {
  try {
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });

    const { rows: rawZones } = await client.execute(`
      SELECT id, nama_zona, lat_pusat, lng_pusat, radius_km
      FROM zona_pengiriman
      WHERE is_active = 1
    `);

    const zones = rawZones
      .map((z: Row) => {
        const lat = parseFloat(String(z.lat_pusat));
        const lng = parseFloat(String(z.lng_pusat));
        return {
          id: Number(z.id),
          nama_zona: String(z.nama_zona),
          lat,
          lng,
          radiusKm: Number(z.radius_km) || 5,
        };
      })
      .filter((z) => Number.isFinite(z.lat) && Number.isFinite(z.lng));

    if (zones.length === 0) {
      return NextResponse.json({ zones: [] });
    }

    const { rows: locations } = await client.execute(`
      SELECT no_wa_pelanggan, lat, lng
      FROM lokasi_pelanggan
      WHERE lat IS NOT NULL AND lng IS NOT NULL
    `);

    const counts = new Map<number, { total: number; customers: Set<string> }>();
    for (const z of zones) counts.set(z.id, { total: 0, customers: new Set<string>() });

    for (const loc of locations as Row[]) {
      const lat = parseFloat(String(loc.lat));
      const lng = parseFloat(String(loc.lng));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const phone = String(loc.no_wa_pelanggan ?? '');
      for (const z of zones) {
        if (haversineKm(lat, lng, z.lat, z.lng) <= z.radiusKm) {
          const c = counts.get(z.id)!;
          c.total += 1;
          if (phone) c.customers.add(phone);
        }
      }
    }

    const result = zones.map((z) => {
      const c = counts.get(z.id)!;
      return {
        nama_zona: z.nama_zona,
        total_kunjungan: c.total,
        total_pelanggan: c.customers.size,
      };
    });

    result.sort((a, b) => b.total_kunjungan - a.total_kunjungan);

    return NextResponse.json({ zones: result });
  } catch (err) {
    console.error('[Analytics/Location/Zones]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
