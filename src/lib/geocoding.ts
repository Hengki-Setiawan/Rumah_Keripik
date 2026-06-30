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
    }
    
    return result;
  } catch (err) {
    console.warn('[Geocoding] Reverse geocoding error:', err);
    return null;
  }
}

/**
 * Forward geocoding: textual address -> coordinates
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const encoded = encodeURIComponent(address + ', Kalimantan Timur, Indonesia');
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
    
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
  } catch (err) {
    console.warn('[Geocoding] Forward geocoding error:', err);
    return null;
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
