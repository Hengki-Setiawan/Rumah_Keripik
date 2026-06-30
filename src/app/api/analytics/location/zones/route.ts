import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });

    const { rows: zones } = await client.execute(`
      SELECT
        z.nama_zona,
        COUNT(l.id) as total_kunjungan,
        COUNT(DISTINCT l.no_wa_pelanggan) as total_pelanggan
      FROM zona_pengiriman z
      LEFT JOIN lokasi_pelanggan l ON 1=1
      GROUP BY z.id, z.nama_zona
      ORDER BY total_kunjungan DESC
    `);

    return NextResponse.json({
      zones: zones.map((z: any) => ({
        nama_zona: z.nama_zona,
        total_kunjungan: Number(z.total_kunjungan),
        total_pelanggan: Number(z.total_pelanggan),
      })),
    });
  } catch (err) {
    console.error('[Analytics/Location/Zones]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
