import { config } from 'dotenv';
config({ path: '.env.local' });

const TURSO_URL = process.env.TURSO_DATABASE_URL!.replace('libsql://', 'https://');
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN!;

// Gudang Makassar
const GUDANG_LAT = -5.134;
const GUDANG_LNG = 119.4135;
const MAX_BACKFILL_KM = 60;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function execute(sql: string, args: unknown[] = []) {
  const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TURSO_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          type: 'execute',
          stmt: { sql, args: args.map((a) => (a === null ? { type: 'null' } : { type: 'text', value: String(a) })) },
        },
        { type: 'close' },
      ],
    }),
  });
  const data = await res.json();
  const r = data.results[0]?.response?.result;
  if (!r) return { rows: [], cols: [] };
  return {
    cols: r.cols,
    rows: r.rows.map((row: any) => Object.fromEntries(r.cols.map((col: any, i: number) => [col.name, row[i]?.value ?? row[i]]))),
  };
}

function inServiceArea(lat: number, lng: number): boolean {
  return haversineKm(lat, lng, GUDANG_LAT, GUDANG_LNG) <= MAX_BACKFILL_KM;
}

async function geocodeViaNominatim(address: string): Promise<{ lat: number; lng: number } | null> {
  const lower = address.toLowerCase();
  // Skip alamat yang jelas di luar area operasional (samarinda, smoke test, dll).
  if (
    lower.includes('samarinda') ||
    lower.includes('jakarta') ||
    lower.includes('kalimantan') ||
    lower.includes('smoke test') ||
    lower.includes('testing') ||
    lower.includes('demo')
  ) {
    return null;
  }
  const query = encodeURIComponent(`${address}, Sulawesi Selatan, Indonesia`);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1&countrycodes=id`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'RumahKeripik-App/1.0 (contact@rumahkeripik.com)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || data.length === 0) return null;
  const lat = parseFloat(data[0].lat);
  const lng = parseFloat(data[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

async function main() {
  const { rows } = await execute(`
    SELECT id_transaksi, kode_pesanan, alamat_penerima, lat_pengiriman, lng_pengiriman
    FROM transaksi
    WHERE order_status IN ('ready', 'confirmed', 'shipping', 'awaiting_admin_confirmation', 'Menunggu_Verifikasi')
  `);

  const missing = rows.filter(
    (r: any) =>
      !r.lat_pengiriman ||
      !r.lng_pengiriman ||
      !Number.isFinite(Number(r.lat_pengiriman)) ||
      !Number.isFinite(Number(r.lng_pengiriman)),
  );

  console.log(`Total pesanan aktif: ${rows.length}`);
  console.log(`Tanpa koordinat valid: ${missing.length}`);
  if (missing.length === 0) {
    console.log('Tidak ada yang perlu di-backfill.');
    return;
  }

  for (const m of missing as any[]) {
    const address = (m.alamat_penerima || '').trim();
    if (!address) {
      console.log(`SKIP ${m.kode_pesanan} - alamat kosong`);
      continue;
    }
    console.log(`Geocode ${m.kode_pesanan}: "${address}" ...`);
    const geo = await geocodeViaNominatim(address);
    if (!geo) {
      console.log(`  -> SKIP (tidak dapat di-geocode / di luar area)`);
      continue;
    }
    const km = haversineKm(geo.lat, geo.lng, GUDANG_LAT, GUDANG_LNG);
    if (!inServiceArea(geo.lat, geo.lng)) {
      console.log(`  -> SKIP (jarak ${km.toFixed(1)} km > ${MAX_BACKFILL_KM} km dari gudang)`);
      continue;
    }
    await execute(
      `UPDATE transaksi SET lat_pengiriman = ?, lng_pengiriman = ?, jarak_km_dari_gudang = ? WHERE id_transaksi = ?`,
      [String(geo.lat), String(geo.lng), String(km.toFixed(2)), m.id_transaksi],
    );
    console.log(`  -> OK lat=${geo.lat.toFixed(6)} lng=${geo.lng.toFixed(6)} jarak=${km.toFixed(1)} km`);
    await new Promise((r) => setTimeout(r, 1100));
  }

  const { rows: after } = await execute(`
    SELECT count(*) as n FROM transaksi
    WHERE order_status IN ('ready', 'confirmed', 'shipping', 'awaiting_admin_confirmation', 'Menunggu_Verifikasi')
      AND lat_pengiriman IS NOT NULL AND lng_pengiriman IS NOT NULL
  `);
  console.log(`\nSelesai. Pesanan aktif dengan koordinat sekarang: ${after[0]?.n ?? 0}`);
}

main().catch(console.error);
