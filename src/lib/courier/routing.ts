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
      // BOUND: k maksimal n-2. Untuk rute TERBUKA (start/end berbeda), membalik
      // segmen yang menyentuh ujung (k = n-1) membuat 'after' = undefined → crash
      // TypeError pada after.lat untuk klaster >= 3 stop. 2-opt segmen-ujung tidak
      // valid secara semantik (mengubah start/end), jadi di-skip.
      for (let k = i + 1; k < n - 1; k++) {
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
  // Guard: segmen menyentuh ujung rute (k = n-1) bukan kandidat 2-opt terbuka.
  if (!after) return 0;

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

function routeCost<T extends LatLng>(r: T[]): number {
  let s = 0;
  for (let i = 0; i < r.length - 1; i++) {
    s += haversineKm(r[i].lat, r[i].lng, r[i + 1].lat, r[i + 1].lng);
  }
  return s;
}

/**
 * Or-opt (node insertion): menghapus satu kota lalu menyisipkannya kembali
 * di posisi terbaik. Suplemen 2-opt — biasanya memberi perbaikan 2-4% lagi.
 */
export function orOpt<T extends LatLng>(route: T[], maxIterations = 20): T[] {
  let r = [...route];
  if (r.length < 4) return r;

  for (let iter = 0; iter < maxIterations; iter++) {
    let improved = false;
    const base = routeCost(r);
    for (let a = 0; a < r.length && !improved; a++) {
      const node = r[a];
      const without = r.filter((_, i) => i !== a);
      let best = r;
      let bestCost = base;
      for (let b = 0; b <= without.length; b++) {
        const cand = [...without.slice(0, b), node, ...without.slice(b)];
        const c = routeCost(cand);
        if (c < bestCost - 1e-9) {
          best = cand;
          bestCost = c;
        }
      }
      if (best !== r) {
        r = best;
        improved = true;
      }
    }
    if (!improved) break;
  }

  return r;
}

export function routeTotalKm<T extends LatLng>(ordered: T[]): number {
  return ordered.length > 1
    ? Math.round(ordered.slice(0, -1).reduce((sum, wp, i) =>
      sum + haversineKm(wp.lat, wp.lng, ordered[i + 1].lat, ordered[i + 1].lng), 0
    ) * 10) / 10
    : 0;
}
