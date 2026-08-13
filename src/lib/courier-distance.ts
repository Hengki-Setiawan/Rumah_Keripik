export interface DistancePoint {
  lat: number;
  lng: number;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Total jarak tempuh (km) sepanjang lintasan titik GPS berurutan.
 * Titik yang tidak valid (0,0 / non-finite) dilewati.
 */
export function sumTrackedDistanceKm(points: DistancePoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  let prev: DistancePoint | null = null;
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || (p.lat === 0 && p.lng === 0)) continue;
    if (prev) total += haversineKm(prev.lat, prev.lng, p.lat, p.lng);
    prev = p;
  }
  return total;
}