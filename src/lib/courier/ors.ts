import { isValidCoordinate } from '@/lib/location-parser';

const ORS_BASE = 'https://api.openrouteservice.org';
const ORS_API_KEY = process.env.ORS_API_KEY || '';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface OrsJob {
  id: number;
  location: [number, number];
  service?: number;
  timeWindows?: Array<[string, string]>;
  amount?: number[];
  priority?: number;
}

export interface OrsVehicle {
  id: number;
  profile?: 'driving-car';
  start: [number, number];
  end?: [number, number];
  capacity?: number[];
  timeWindow?: [string, string];
}

export interface OrsOptimizeResult {
  routes: Array<{
    steps: Array<{ type: string; job?: number; location: [number, number]; service?: number }>;
    distance: number;
    duration: number;
  }>;
  summary?: {
    distance: number;
    duration: number;
  };
}

/** TRUE jika key ORS tersedia (fitur opsional hanya aktif saat key ada). */
export function orsEnabled(): boolean {
  return ORS_API_KEY.length > 0;
}

function authHeaders(): Record<string, string> {
  return { Authorization: ORS_API_KEY, 'Content-Type': 'application/json' };
}

async function orsPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${ORS_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) {
    throw new Error(`ORS ${path} error ${res.status}: ${await res.text().catch(() => '')}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Optimization (VROOM). Mendukung multi-vehicle (banyak kurir sekaligus),
 * service time per stop, priority, dan capacity. Sisanya di-handle VROOM.
 * Pastikan kandidat kurir memiliki start (posisi gudang/GPS) terlebih dahulu.
 */
export async function optimizeMultiVehicle(
  vehicles: OrsVehicle[],
  jobs: OrsJob[],
): Promise<OrsOptimizeResult> {
  if (!orsEnabled()) throw new Error('ORS_API_KEY tidak tersedia');
  return orsPost<OrsOptimizeResult>('/optimization', { jobs, vehicles });
}

/**
 * Directions: geometri + jarak + durasi jalan asli antara dua titik.
 * `service` optional digunakan untuk tambahan waktu stop pada durasi rute.
 */
export async function fetchDirections(
  from: LatLng,
  to: LatLng,
  profile: 'driving-car' = 'driving-car',
  options: { service?: number } = {},
): Promise<{ distanceM: number; durationS: number }> {
  if (!orsEnabled()) throw new Error('ORS_API_KEY tidak tersedia');
  const data = await orsPost<{ routes: Array<{ summary: { distance: number; duration: number } }> }>(
    `/v2/directions/${profile}`,
    {
      coordinates: [[from.lng, from.lat], [to.lng, to.lat]],
      instructions: false,
      options: options.service ? { round_trip: false } : undefined,
    },
  );
  const route = data.routes[0];
  const durationS = route.summary.duration + (options.service ?? 0);
  return { distanceM: route.summary.distance, durationS };
}

/**
 * Isochrones: polygon area yang bisa dicapai dalam `rangeSec` detik dari
 * titik pusat. Dipakai untuk zona layanan berbasis jaringan jalan.
 * Endpoint `/geojson` mengembalikan FeatureCollection; tiap feature adalah
 * satu polygon dengan `properties.value` = range (detik) dan
 * `geometry.coordinates` = ring [[lng,lat],...].
 */
export async function fetchIsochrones(
  center: LatLng,
  rangesSec: number[],
  profile: 'driving-car' = 'driving-car',
): Promise<Array<{ range: number; polygon: Array<[number, number]> }>> {
  if (!orsEnabled()) throw new Error('ORS_API_KEY tidak tersedia');
  const data = await orsPost<{
    features?: Array<{
      properties?: { value?: number };
      geometry?: { type?: string; coordinates?: Array<Array<[number, number]>> };
    }>;
  }>(`/v2/isochrones/${profile}/geojson`, {
    locations: [[center.lng, center.lat]],
    range: rangesSec,
    range_type: 'time',
    attributes: [],
  });
  return (data.features ?? [])
    .filter((f) => f.geometry?.type === 'Polygon' && Array.isArray(f.geometry.coordinates))
    .map((f) => ({
      range: f.properties?.value ?? 0,
      polygon: (f.geometry?.coordinates?.[0] ?? []).map(([lng, lat]) => [lng, lat] as [number, number]),
    }))
    .filter((z) => z.polygon.length >= 3);
}

/** Point-in-polygon (ray casting) untuk cek order masuk area layanan. */
export function isInsidePolygon(point: LatLng, polygon: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
      (point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export interface OrsGeocodeHit {
  lat: number;
  lng: number;
  confidence: number;
  label: string;
}

/**
 * Forward geocode: teks alamat -> koordinat, dibias ke sekitar `focus` (gudang).
 * Mendukung `boundary.country` untuk membatasi hasil ke satu negara (ID).
 */
export async function orsGeocode(
  address: string,
  options: { focus?: LatLng; country?: string; limit?: number } = {},
): Promise<OrsGeocodeHit[]> {
  if (!orsEnabled()) return [];
  const url = new URL(`${ORS_BASE}/geocode/search`);
  url.searchParams.set('text', address);
  url.searchParams.set('size', String(options.limit ?? 3));
  if (options.country) url.searchParams.set('boundary.country', options.country);
  if (options.focus) url.searchParams.set('focus.point.lon', String(options.focus.lng));
  if (options.focus) url.searchParams.set('focus.point.lat', String(options.focus.lat));

  const res = await fetch(url, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];

  const data = await res.json().catch(() => null);
  const hits = data?.features ?? [];
  return (hits as Array<{
    geometry?: { coordinates?: [number, number] };
    properties?: { confidence?: number; label?: string; name?: string; country?: string };
  }>)
    .map((f) => {
      const [lng, lat] = f.geometry?.coordinates ?? [null, null];
      return {
        lat: Number(lat),
        lng: Number(lng),
        confidence: f.properties?.confidence ?? 0,
        label: f.properties?.label || f.properties?.name || '',
      };
    })
    .filter((h) => isValidCoordinate(h.lat, h.lng));
}