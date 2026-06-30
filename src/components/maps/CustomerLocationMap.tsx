'use client';

import { useEffect, useRef, useState } from 'react';
import { Users, MapPin } from 'lucide-react';

interface CustomerPoint {
  no_wa: string;
  nama?: string | null;
  lat: number;
  lng: number;
  total_order?: number;
  alamat?: string | null;
}

interface CustomerLocationMapProps {
  points?: CustomerPoint[];
  height?: number;
  gudangLat?: number;
  gudangLng?: number;
}

export function CustomerLocationMap({
  points = [],
  height = 400,
  gudangLat = -0.5022,
  gudangLng = 117.1536,
}: CustomerLocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function initMap() {
      if (!mapRef.current || mapInstanceRef.current) return;

      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      if (!mounted || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [gudangLat, gudangLng],
        zoom: 11,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Marker gudang
      const gudangIcon = L.divIcon({
        html: '<div style="background:#ef4444;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:8px;color:white;font-weight:bold">G</div>',
        className: '',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker([gudangLat, gudangLng], { icon: gudangIcon })
        .addTo(map)
        .bindPopup('<b>📦 Gudang Rumah Keripik</b>');

      // Marker pelanggan
      let count = 0;
      for (const pt of points) {
        if (!pt.lat || !pt.lng) continue;
        count++;

        const size = Math.min(8 + (pt.total_order || 1) * 2, 18);
        const custIcon = L.divIcon({
          html: `<div style="background:#8B5CF6;width:${size}px;height:${size}px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);opacity:0.8"></div>`,
          className: '',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        L.marker([pt.lat, pt.lng], { icon: custIcon })
          .addTo(map)
          .bindPopup(
            `<b>${pt.nama || pt.no_wa}</b><br>` +
            (pt.alamat ? `${pt.alamat}<br>` : '') +
            `${pt.total_order || 0} order`
          );
      }

      setCount(count);
      mapInstanceRef.current = map;
    }

    initMap();

    return () => {
      mounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-on-surface-variant flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow" />
          <span>Gudang</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-violet-500 opacity-80 border-2 border-white shadow" />
          <span>Pelanggan (ukuran = frekuensi order)</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <Users size={13} />
          <span className="font-semibold">{count} pelanggan terpetakan</span>
        </div>
      </div>

      {/* Map */}
      {points.length === 0 ? (
        <div
          style={{ height }}
          className="flex flex-col items-center justify-center gap-3 bg-surface-container rounded-xl border border-outline-variant/20 text-on-surface-variant"
        >
          <MapPin size={40} className="text-outline-variant" />
          <p className="text-sm">Belum ada data lokasi pelanggan</p>
          <p className="text-xs text-center max-w-64">
            Data lokasi akan muncul setelah pelanggan mengirimkan pin lokasi atau link Google Maps
          </p>
        </div>
      ) : (
        <div
          ref={mapRef}
          style={{ height }}
          className="rounded-xl border border-outline-variant/20 overflow-hidden"
        />
      )}
    </div>
  );
}
