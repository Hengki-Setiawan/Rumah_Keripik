import type leaflet from 'leaflet';

/**
 * Leaflet.heat compatibility layer.
 * Falls back to circle markers if leaflet.heat is not available.
 */

interface HeatPoint {
  lat: number;
  lng: number;
  weight: number;
}

export function createHeatLayer(
  L: typeof leaflet,
  points: HeatPoint[],
): leaflet.LayerGroup {
  const group = L.layerGroup();
  const maxWeight = Math.max(...points.map((p) => p.weight), 1);

  for (const point of points) {
    const intensity = point.weight / maxWeight;
    const radius = Math.max(8, intensity * 25);
    const opacity = Math.max(0.2, intensity);

    const color =
      intensity > 0.7 ? '#ef4444' :
      intensity > 0.4 ? '#f59e0b' :
      '#3b82f6';

    const circle = L.circleMarker([point.lat, point.lng], {
      radius,
      color,
      fillColor: color,
      fillOpacity: opacity,
      weight: 1,
      opacity: 0.6,
    });

    group.addLayer(circle);
  }

  return group;
}
