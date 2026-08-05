export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface LatLng {
  lat: number;
  lng: number;
}

export function nearestNeighbor<T extends LatLng>(
  points: T[],
  startLat?: number,
  startLng?: number
): T[] {
  if (points.length <= 1) return points;

  const unvisited = [...points];
  const ordered: T[] = [];
  let currentLat = startLat ?? points[0].lat;
  let currentLng = startLng ?? points[0].lng;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const d = haversineKm(currentLat, currentLng, unvisited[i].lat, unvisited[i].lng);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    const next = unvisited.splice(nearestIdx, 1)[0];
    ordered.push(next);
    currentLat = next.lat;
    currentLng = next.lng;
  }

  return ordered;
}

/**
 * 2-opt local search: memperbaiki urutan rute dengan membalik segment (i..k)
 * bila itu memperpendek total jarak. Diulang sampai tidak ada perbaikan lagi
 * (bounded iteration). Nearest-neighbor adalah konstruksi awal (greedy);
 * 2-opt adalah local search improvement.
 */
export function twoOpt<T extends LatLng>(route: T[], maxIterations = 50): T[] {
  const n = route.length;
  if (n < 3) return route;

  let improved = true;
  let iterations = 0;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;
    for (let i = 1; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const delta = twoOptGain(route, i, k);
        if (delta < -1e-9) {
          reverseSegment(route, i, k);
          improved = true;
        }
      }
    }
  }

  return route;
}

function twoOptGain<T extends LatLng>(route: T[], i: number, k: number): number {
  const before = route[i - 1];
  const a = route[i];
  const b = route[k];
  const after = route[k + 1];

  const removed = haversineKm(before.lat, before.lng, a.lat, a.lng) +
    haversineKm(b.lat, b.lng, after.lat, after.lng);
  const added = haversineKm(before.lat, before.lng, b.lat, b.lng) +
    haversineKm(a.lat, a.lng, after.lat, after.lng);
  return added - removed;
}

function reverseSegment<T>(route: T[], i: number, k: number): void {
  while (i < k) {
    const tmp = route[i];
    route[i] = route[k];
    route[k] = tmp;
    i++;
    k--;
  }
}

export function routeTotalKm<T extends LatLng>(ordered: T[]): number {
  return ordered.length > 1
    ? Math.round(ordered.slice(0, -1).reduce((sum, wp, i) =>
      sum + haversineKm(wp.lat, wp.lng, ordered[i + 1].lat, ordered[i + 1].lng), 0
    ) * 10) / 10
    : 0;
}
