import { db } from '@/lib/db';
import { aiKnowledgeBase } from '@/lib/schema';
import { isNull, and, eq } from 'drizzle-orm';
import { generateEmbedding } from '@/lib/gemini';

/**
 * Re-embed satu chunk knowledge base yang belum punya vector_embedding.
 * Dipakai oleh job worker `reembed_knowledge`.
 */
export async function indexKnowledgeChunk(id: string | number): Promise<{ id: string | number; embedded: boolean }> {
  const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
  const [row] = await db
    .select({ id: aiKnowledgeBase.id, teks: aiKnowledgeBase.potongan_teks })
    .from(aiKnowledgeBase)
    .where(and(eq(aiKnowledgeBase.id, numericId), isNull(aiKnowledgeBase.vector_embedding)))
    .limit(1);

  if (!row) return { id, embedded: false };

  const result = await generateEmbedding(row.teks);
  const buffer = Buffer.from(new Float32Array(result.embedding).buffer);
  await db
    .update(aiKnowledgeBase)
    .set({ vector_embedding: buffer })
    .where(eq(aiKnowledgeBase.id, row.id));

  return { id: row.id, embedded: true };
}

/**
 * Re-embed N chunk pertama yang belum punya embedding.
 * Semua error per-chunk ditangkap agar satu kegagalan tidak membatalkan batch.
 */
export async function indexKnowledgeWithoutEmbedding(limit = 20): Promise<{
  scanned: number[];
  embedded: number;
  failed: number;
}> {
  const rows = await db
    .select({ id: aiKnowledgeBase.id, teks: aiKnowledgeBase.potongan_teks })
    .from(aiKnowledgeBase)
    .where(isNull(aiKnowledgeBase.vector_embedding))
    .limit(limit);

  let embedded = 0;
  let failed = 0;
  const scanned: number[] = [];

  for (const row of rows) {
    scanned.push(row.id);
    try {
      await indexKnowledgeChunk(row.id);
      embedded += 1;
    } catch {
      failed += 1;
    }
  }

  return { scanned, embedded, failed };
}

/**
 * Refresh zona pengiriman: hitung ulang `total_order_bulan_ini` untuk tiap zona
 * berdasarkan jarak Haversine koordinat kirim transaksi dari pusat zona
 * (`lat_pusat`/`lng_pusat`, dalam `radius_km`).
 * Dipakai oleh job worker `refresh_location_zones`.
 */
export async function refreshLocationZones(): Promise<{ zones: number; tagged: number }> {
  const { zonaPengiriman, transaksi } = await import('@/lib/schema');
  const { calculateDistance } = await import('@/lib/location-parser');
  const { sql, eq, and, gte } = await import('drizzle-orm');
  const { db } = await import('@/lib/db');

  const zones = await db
    .select()
    .from(zonaPengiriman)
    .where(eq(zonaPengiriman.is_active, 1));

  if (zones.length === 0) return { zones: 0, tagged: 0 };

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startOfMonthIso = startOfMonth.toISOString();
  const startOfMonthSqlite = startOfMonthIso.replace('T', ' ').slice(0, 19);

  const orders = await db
    .select({ lat: transaksi.lat_pengiriman, lng: transaksi.lng_pengiriman })
    .from(transaksi)
    .where(and(
      sql`${transaksi.lat_pengiriman} IS NOT NULL`,
      sql`${transaksi.lng_pengiriman} IS NOT NULL`,
      gte(transaksi.waktu_simpan, startOfMonthSqlite),
    ))
    .limit(2000);

  let tagged = 0;
  for (const zone of zones) {
    const zLat = zone.lat_pusat == null ? NaN : parseFloat(zone.lat_pusat);
    const zLng = zone.lng_pusat == null ? NaN : parseFloat(zone.lng_pusat);
    const radius = zone.radius_km ?? 5;
    if (!Number.isFinite(zLat) || !Number.isFinite(zLng)) continue;

    const inZone = orders.filter((o) => {
      const lat = o.lat == null ? NaN : parseFloat(o.lat);
      const lng = o.lng == null ? NaN : parseFloat(o.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      return calculateDistance(lat, lng, zLat, zLng) <= radius;
    });

    await db
      .update(zonaPengiriman)
      .set({ total_order_bulan_ini: inZone.length })
      .where(eq(zonaPengiriman.id, zone.id));
    tagged += inZone.length;
  }

  return { zones: zones.length, tagged };
}