import { eq } from 'drizzle-orm';
import { db } from './db';
import { geocodeCache } from './schema';
import { isValidCoordinate } from './location-parser';
import { orsGeocode } from '@/lib/courier/ors';

const WAREHOUSE_LAT = -5.134;
const WAREHOUSE_LNG = 119.4135;

const GEOCODING_CACHE = new Map<string, string>();

/**
 * Reverse geocoding: coordinates -> textual address
 * Using OpenStreetMap Nominatim (Free)
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  
  if (GEOCODING_CACHE.has(cacheKey)) {
    return GEOCODING_CACHE.get(cacheKey)!;
  }

  const dbCached = await getCachedGeocode(cacheKey);
  if (dbCached?.formatted_address) {
    GEOCODING_CACHE.set(cacheKey, dbCached.formatted_address);
    return dbCached.formatted_address;
  }
  
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'RumahKeripik-App/1.0 (contact@rumahkeripik.com)',
        'Accept-Language': 'id,en',
      },
      signal: AbortSignal.timeout(8000),
    });
    
    if (!res.ok) {
      console.warn('[Geocoding] Nominatim response error:', res.status);
      return null;
    }
    
    const data = await res.json();
    const addr = data.address || {};
    
    // Construct address parts
    const parts = [
      addr.road || addr.pedestrian || addr.path || addr.suburb || addr.neighbourhood,
      addr.house_number ? `No. ${addr.house_number}` : null,
      addr.city || addr.town || addr.village || addr.municipality || addr.county,
      addr.state || addr.region,
    ].filter(Boolean);
    
    const result = parts.length > 0 ? parts.join(', ') : data.display_name;
    
    if (result) {
      GEOCODING_CACHE.set(cacheKey, result);
      await saveGeocodeCache(cacheKey, {
        lat,
        lng,
        formatted_address: result,
        raw_json: JSON.stringify(data),
      });
    }
    
    return result;
  } catch (err) {
    console.warn('[Geocoding] Reverse geocoding error:', err);
    return null;
  }
}

/**
 * Forward geocoding: textual address -> coordinates
 *
 * NOTE: bisnis berpusat di Makassar, Sulawesi Selatan (gudang -5.1340, 119.4135).
 * Bug lama menambahkan "Kalimantan Timur" sehingga hampir semua alamat di-geocode
 * ke provinsi yang salah / gagal. Region diturunkan dari isi alamat, fallback Sulsel.
 */
function geocodeRegion(address: string): string {
  const lower = address.toLowerCase();
  if (lower.includes('sulawesi selatan') || lower.includes('sulsel')) {
    return 'Sulawesi Selatan, Indonesia';
  }
  // Kota/kabupaten utama sekitar gudang -> pastikan tetap di Sulsel.
  if (
    lower.includes('makassar') ||
    lower.includes('gowa') ||
    lower.includes('maros') ||
    lower.includes('takalar') ||
    lower.includes('pangkep') ||
    lower.includes('sungguminasa') ||
    lower.includes('biringkanaya') ||
    lower.includes('panakkukang')
  ) {
    return 'Sulawesi Selatan, Indonesia';
  }
  return 'Sulawesi Selatan, Indonesia';
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const query = `${address}, ${geocodeRegion(address)}`;
    const cached = await getCachedGeocode(query);
    if (cached?.lat && cached.lng) {
      const lat = Number(cached.lat);
      const lng = Number(cached.lng);
      if (isValidCoordinate(lat, lng)) return { lat, lng };
    }

    // 1) ORS Geocoding (Pelias) — primary. Dibias ke area gudang Makassar,
    //    dibatasi negara ID supaya "Kalimantan Timur"-style false-positive
    //    (bug lama Nominatim) tidak terulang.
    const orsHits = await orsGeocode(address, {
      focus: { lat: WAREHOUSE_LAT, lng: WAREHOUSE_LNG },
      country: 'ID',
      limit: 1,
    });
    if (orsHits.length > 0) {
      const hit = orsHits[0];
      await saveGeocodeCache(query, {
        lat: hit.lat,
        lng: hit.lng,
        formatted_address: hit.label || address,
        raw_json: JSON.stringify({ source: 'ors-pelias', confidence: hit.confidence }),
      });
      return { lat: hit.lat, lng: hit.lng };
    }

    // 2) Fallback: Nominatim (regions sudah dipin ke Sulsel).
    const encoded = encodeURIComponent(query);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1`;
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'RumahKeripik-App/1.0 (contact@rumahkeripik.com)',
      },
      signal: AbortSignal.timeout(8000),
    });
    
    if (!res.ok) return null;
    
    const data = await res.json();
    if (!data || data.length === 0) return null;

    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (!isValidCoordinate(lat, lng)) return null;

    await saveGeocodeCache(query, {
      lat,
      lng,
      formatted_address: data[0].display_name || address,
      raw_json: JSON.stringify(data[0]),
    });

    return { lat, lng };
  } catch (err) {
    console.warn('[Geocoding] Forward geocoding error:', err);
    return null;
  }
}

/**
 * Resolve koordinat order. Jika pelanggan sudah memberi lat/lng (pin maps /
 * GPS) langsung dipakai; jika tidak, otomatis geocode dari teks alamat.
 * Berjalan di luar transaksi sehingga kegagalan geocoding tidak menggagalkan
 * pembuatan order — order tetap tersimpan, koordinat diisi belakangan (backfill).
 */
export async function resolveOrderCoordinates(
  addressText: string,
  lat?: string | null,
  lng?: string | null,
): Promise<{ lat: string | null; lng: string | null; source: 'manual' | 'gps' | 'geocoded' }> {
  const hasExplicit = lat && lng && isValidCoordinate(Number(lat), Number(lng));
  if (hasExplicit) {
    return { lat, lng, source: 'manual' };
  }
  if (!addressText || addressText.trim().length === 0) {
    return { lat: null, lng: null, source: 'manual' };
  }
  try {
    const hit = await geocodeAddress(addressText.trim());
    if (hit) {
      return { lat: String(hit.lat), lng: String(hit.lng), source: 'geocoded' };
    }
  } catch {
    // silent — order tetap jalan tanpa koordinat
  }
  return { lat: null, lng: null, source: 'manual' };
}

async function getCachedGeocode(query: string) {
  try {
    return await db
      .select()
      .from(geocodeCache)
      .where(eq(geocodeCache.query, query))
      .limit(1)
      .then((rows) => rows[0]);
  } catch {
    return null;
  }
}

async function saveGeocodeCache(
  query: string,
  data: { lat: number; lng: number; formatted_address?: string | null; raw_json?: string | null },
) {
  try {
    await db
      .insert(geocodeCache)
      .values({
        query,
        lat: String(data.lat),
        lng: String(data.lng),
        formatted_address: data.formatted_address || null,
        raw_json: data.raw_json || null,
      })
      .onConflictDoNothing();
  } catch {
    // Cache miss is acceptable; geocoding should never block order flow.
  }
}

export interface ShippingCostEstimate {
  estimasi_min: number;
  estimasi_max: number;
  zona: string;
  ongkir: number;
}

/**
 * Ongkos kirim calculator berdasarkan jarak dari gudang utama
 */
export function estimateShipping(distanceKm: number): ShippingCostEstimate {
  if (distanceKm <= 5) {
    return { estimasi_min: 0, estimasi_max: 5000, zona: 'Dalam Kota (Dekat)', ongkir: 0 };
  } else if (distanceKm <= 15) {
    return { estimasi_min: 5000, estimasi_max: 15000, zona: 'Dalam Kota (Sedang)', ongkir: 8000 };
  } else if (distanceKm <= 30) {
    return { estimasi_min: 15000, estimasi_max: 30000, zona: 'Pinggiran Kota', ongkir: 20000 };
  } else {
    return { estimasi_min: 30000, estimasi_max: 80000, zona: 'Luar Kota', ongkir: 45000 };
  }
}
