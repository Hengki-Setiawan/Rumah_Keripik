export interface ParsedLocation {
  lat: number;
  lng: number;
  address?: string;           // Alamat dari WA jika ada
  source: 'wa_native' | 'wa_live' | 'maps_link' | 'maps_short' | 'geocoded';
  accuracy?: number;          // Untuk live location
  original_text?: string;
  maps_link?: string;
}

/**
 * Validasi apakah koordinat valid
 */
export function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat !== 0 &&
    lng !== 0 &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

/**
 * Build Google Maps link yang bisa diklik
 */
export function buildMapsLink(lat: number, lng: number, label?: string): string {
  const query = label 
    ? `${encodeURIComponent(label)}@${lat},${lng}`
    : `${lat},${lng}`;
  return `https://maps.google.com/?q=${query}`;
}

/**
 * Build link Google Maps dari string alamat
 */
export function buildMapsLinkFromAddress(address: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
}

/**
 * Hitung jarak Haversine (km) antara 2 koordinat
 */
export function calculateDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371; // Radius bumi dalam km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Parse location dari payload message Evolution
 */
export function parseWALocationPayload(message: any): ParsedLocation | null {
  if (!message || typeof message !== 'object') return null;

  // Tipe 1: locationMessage
  const loc = message.locationMessage;
  if (loc && loc.degreesLatitude !== undefined) {
    const lat = Number(loc.degreesLatitude);
    const lng = Number(loc.degreesLongitude);
    if (isValidCoordinate(lat, lng)) {
      return {
        lat,
        lng,
        address: [loc.name, loc.address].filter(Boolean).join(', ') || undefined,
        source: 'wa_native',
        maps_link: buildMapsLink(lat, lng),
      };
    }
  }

  // Tipe 2: liveLocationMessage
  const live = message.liveLocationMessage;
  if (live && live.degreesLatitude !== undefined) {
    const lat = Number(live.degreesLatitude);
    const lng = Number(live.degreesLongitude);
    if (isValidCoordinate(lat, lng)) {
      return {
        lat,
        lng,
        source: 'wa_live',
        accuracy: live.accuracyInMeters ? Number(live.accuracyInMeters) : undefined,
        maps_link: buildMapsLink(lat, lng),
      };
    }
  }

  return null;
}

/**
 * Extract koordinat dari URL Google Maps (atau unshorten short link)
 */
export async function extractCoordsFromText(text: string): Promise<ParsedLocation | null> {
  const MAPS_URL_RE = /https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.com|www\.google\.com\/maps|google\.com\/maps)[^\s]*/gi;
  const matches = text.match(MAPS_URL_RE);
  
  if (!matches || matches.length === 0) return null;
  
  const url = matches[0];
  
  // Try direct parsing first
  const directResult = parseFullMapsUrl(url);
  if (directResult) return { ...directResult, original_text: url };
  
  // If it's a short URL, expand it first
  const SHORT_URL_RE = /https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//i;
  if (SHORT_URL_RE.test(url)) {
    const expanded = await followRedirect(url);
    if (expanded) {
      const result = parseFullMapsUrl(expanded);
      if (result) return { 
        ...result, 
        source: 'maps_short', 
        original_text: url 
      };
    }
  }
  
  return null;
}

/**
 * Parse full URL format Google Maps
 */
function parseFullMapsUrl(url: string): Omit<ParsedLocation, 'original_text'> | null {
  // Pattern 1: /@lat,lng
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng, source: 'maps_link', maps_link: buildMapsLink(lat, lng) };
    }
  }
  
  // Pattern 2: ?q=lat,lng
  const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng, source: 'maps_link', maps_link: buildMapsLink(lat, lng) };
    }
  }
  
  // Pattern 3: ?ll=lat,lng
  const llMatch = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (llMatch) {
    const lat = parseFloat(llMatch[1]);
    const lng = parseFloat(llMatch[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng, source: 'maps_link', maps_link: buildMapsLink(lat, lng) };
    }
  }
  
  return null;
}

/**
 * HTTP Redirect Follower
 */
async function followRedirect(shortUrl: string): Promise<string | null> {
  try {
    const res = await fetch(shortUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    });
    return res.url || null;
  } catch {
    try {
      const res = await fetch(shortUrl, {
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });
      return res.url || null;
    } catch {
      return null;
    }
  }
}
