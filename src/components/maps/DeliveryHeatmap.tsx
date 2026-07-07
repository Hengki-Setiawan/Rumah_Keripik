'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const MiniDeliveryMap = dynamic(
  () => import('./MiniDeliveryMap').then((m) => m.MiniDeliveryMap),
  { ssr: false, loading: () => <div className="h-64 bg-surface-container animate-pulse rounded-xl" /> },
);

interface HeatmapPoint {
  lat: number;
  lng: number;
  weight: number;
  kode_pesanan?: string;
  nama?: string;
  status?: string;
}

interface ZoneStats {
  nama_zona: string;
  lat: number;
  lng: number;
  total_order: number;
  total_nilai: number;
}

interface DeliveryHeatmapProps {
  height?: number;
  showControls?: boolean;
}

export function DeliveryHeatmap({ height = 450, showControls = true }: DeliveryHeatmapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [heatGroup, setHeatGroup] = useState<any>(null);
  const [markerGroup, setMarkerGroup] = useState<any>(null);
  const [mode, setMode] = useState<'heatmap' | 'markers' | 'both'>('heatmap');
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('7d');
  const [data, setData] = useState<HeatmapPoint[]>([]);
  const [zones, setZones] = useState<ZoneStats[]>([]);
  const [loading, setLoading] = useState(true);

  const GUDANG_LAT = -0.5022;
  const GUDANG_LNG = 117.1536;

  useEffect(() => {
    let map: any;

    async function initMap() {
      if (!mapRef.current) return;

      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      map = L.map(mapRef.current, {
        center: [GUDANG_LAT, GUDANG_LNG],
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const gudangIcon = L.divIcon({
        html: '<div style="background:#ef4444;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>',
        className: '',
        iconSize: [16, 16],
      });

      L.marker([GUDANG_LAT, GUDANG_LNG], { icon: gudangIcon })
        .addTo(map)
        .bindPopup('Gudang Rumah Keripik');

      setMapInstance(map);
    }

    initMap();

    return () => {
      if (map) map.remove();
    };
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/location/heatmap?period=${period}`);
      if (res.ok) {
        const d = await res.json();
        setData(d.points || []);
        setZones(d.zones || []);
      }
    } catch (err) {
      console.error('[Heatmap] Fetch error:', err);
    }
    setLoading(false);
  }

  async function updateMapLayers() {
    if (!mapInstance) return;
    const L = (await import('leaflet')).default;

    if (heatGroup) {
      mapInstance.removeLayer(heatGroup);
    }
    if (markerGroup) {
      mapInstance.removeLayer(markerGroup);
    }

    if (mode === 'heatmap' || mode === 'both') {
      const { createHeatLayer } = await import('@/lib/leaflet-heat-compat');
      const points = data.map((p) => ({ lat: p.lat, lng: p.lng, weight: p.weight }));
      const group = createHeatLayer(L, points);
      group.addTo(mapInstance);
      setHeatGroup(group);
    } else {
      setHeatGroup(null);
    }

    if (mode === 'markers' || mode === 'both') {
      const nextMarkerGroup = L.layerGroup();
      data.forEach((point) => {
        if (!point.lat || !point.lng) return;

        const color = point.status === 'Menunggu_Verifikasi' ? '#f59e0b'
          : point.status === 'Lunas' ? '#22c55e' : '#6b7280';

        const icon = L.divIcon({
          html: `<div style="background:${color};width:10px;height:10px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
          className: '',
          iconSize: [10, 10],
        });

        L.marker([point.lat, point.lng], { icon })
          .addTo(nextMarkerGroup)
          .bindPopup(
            point.kode_pesanan
              ? `<b>${point.kode_pesanan}</b><br>${point.nama || ''}`
              : 'Pesanan',
          );
      });
      nextMarkerGroup.addTo(mapInstance);
      setMarkerGroup(nextMarkerGroup);
    } else {
      setMarkerGroup(null);
    }
  }

  useEffect(() => {
    fetchData().catch(() => undefined);
  }, [period]);

  useEffect(() => {
    if (!mapInstance || !data.length) return;
    updateMapLayers().catch(() => undefined);
  }, [mapInstance, data, mode]);

  return (
    <div className="space-y-4">
      {showControls && (
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex rounded-lg border overflow-hidden">
            {(['today', '7d', '30d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  period === p
                    ? 'bg-primary text-on-primary'
                    : 'hover:bg-surface-container'
                }`}
              >
                {p === 'today' ? 'Hari Ini' : p === '7d' ? '7 Hari' : '30 Hari'}
              </button>
            ))}
          </div>

          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
            className="text-sm px-3 py-1.5 rounded-lg border bg-surface-container-lowest"
          >
            <option value="heatmap">Heatmap</option>
            <option value="markers">Marker</option>
            <option value="both">Keduanya</option>
          </select>
        </div>
      )}

      <div
        ref={mapRef}
        style={{ height: `${height}px` }}
        className="rounded-xl border overflow-hidden"
      />

      {zones.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {zones.map((z, i) => (
            <div key={i} className="bg-surface-container-lowest border rounded-lg p-3 text-sm">
              <p className="font-medium truncate">{z.nama_zona}</p>
              <p className="text-on-surface-variant">{z.total_order} order</p>
              <p className="font-medium text-xs">
                Rp {z.total_nilai.toLocaleString('id-ID')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
