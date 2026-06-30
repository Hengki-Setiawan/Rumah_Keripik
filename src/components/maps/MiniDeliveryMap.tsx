'use client';

import { useEffect, useRef } from 'react';

interface MiniDeliveryMapProps {
  lat: number;
  lng: number;
  label?: string;
  height?: number;
  showGudang?: boolean;
}

const GUDANG_LAT = -0.5022;
const GUDANG_LNG = 117.1536;

export function MiniDeliveryMap({
  lat, lng, label, height = 180, showGudang = true,
}: MiniDeliveryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    let map: any;

    async function init() {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      const centerLat = (lat + GUDANG_LAT) / 2;
      const centerLng = (lng + GUDANG_LNG) / 2;

      map = L.map(mapRef.current!, {
        center: [centerLat, centerLng],
        zoom: 12,
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OSM',
        maxZoom: 19,
      }).addTo(map);

      const destIcon = L.divIcon({
        html: '<div style="background:#22c55e;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>',
        className: '',
        iconSize: [14, 14],
      });

      L.marker([lat, lng], { icon: destIcon })
        .addTo(map)
        .bindPopup(label || 'Tujuan Pengiriman');

      if (showGudang) {
        const gudangIcon = L.divIcon({
          html: '<div style="background:#ef4444;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>',
          className: '',
          iconSize: [14, 14],
        });

        L.marker([GUDANG_LAT, GUDANG_LNG], { icon: gudangIcon })
          .addTo(map)
          .bindPopup('Gudang Rumah Keripik');

        L.polyline(
          [[GUDANG_LAT, GUDANG_LNG], [lat, lng]],
          { color: '#6366f1', weight: 2, dashArray: '5,5' },
        ).addTo(map);
      }

      const bounds = L.latLngBounds([[GUDANG_LAT, GUDANG_LNG], [lat, lng]]);
      map.fitBounds(bounds, { padding: [20, 20] });
    }

    init();

    return () => {
      if (map) map.remove();
    };
  }, [lat, lng, label, showGudang]);

  return (
    <div
      ref={mapRef}
      style={{ height: `${height}px` }}
      className="w-full rounded-lg overflow-hidden"
    />
  );
}
