'use client';

import { useEffect, useRef, useState } from 'react';
import { Navigation, RefreshCw, Truck } from 'lucide-react';

interface CourierLocation {
  id: number;
  name: string;
  phone: string;
  vehicle: string | null;
  last_lat: string | null;
  last_lng: string | null;
  last_location_at: string | null;
  is_active: boolean;
}

export default function LiveCourierMapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [couriers, setCouriers] = useState<CourierLocation[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch('/api/admin/couriers');
      const data = await res.json();
      setCouriers(data.couriers || []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      if (!mapRef.current) return;
      mapInstance.current = L.map(mapRef.current, {
        center: [-0.5022, 117.1536],
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(mapInstance.current);
    })();
    return () => { mapInstance.current?.remove(); mapInstance.current = null; };
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    (async () => {
      const L = (await import('leaflet')).default;
      const gudangIcon = L.divIcon({ html: '<div style="background:#c55a2b;color:#fff;border-radius:8px;padding:2px 6px;font-size:10px;font-weight:600;">Gudang</div>', className: '', iconSize: [60, 20], iconAnchor: [30, 10] });
      const courierIcon = L.divIcon({ html: '<div style="background:#2563eb;color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">📦</div>', className: '', iconSize: [28, 28], iconAnchor: [14, 14] });

      L.marker([-0.5022, 117.1536], { icon: gudangIcon }).addTo(mapInstance.current).bindPopup('<b>Gudang Rumah Keripik</b>');

      for (const c of couriers) {
        if (!c.last_lat || !c.last_lng) continue;
        const marker = L.marker([parseFloat(c.last_lat), parseFloat(c.last_lng)], { icon: courierIcon })
          .addTo(mapInstance.current)
          .bindPopup(`<b>${c.name}</b><br>${c.vehicle || '-'}<br>${c.phone}<br><small>${c.last_location_at ? new Date(c.last_location_at).toLocaleString('id-ID') : '-'}</small>`);
        markersRef.current.push(marker);
      }
    })();
  }, [couriers]);

  const activeWithLocation = couriers.filter((c) => c.is_active && c.last_lat && c.last_lng);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Navigation className="w-7 h-7 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-800">Lokasi Kurir Live</h1>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-lg border p-3">
          <p className="text-2xl font-bold text-blue-600">{activeWithLocation.length}</p>
          <p className="text-xs text-gray-500">Kurir Aktif (dengan lokasi)</p>
        </div>
        <div className="bg-white rounded-lg border p-3">
          <p className="text-2xl font-bold text-gray-800">{couriers.filter((c) => c.is_active).length}</p>
          <p className="text-xs text-gray-500">Total Kurir Aktif</p>
        </div>
      </div>

      <div ref={mapRef} className="w-full rounded-xl border overflow-hidden" style={{ height: '500px' }} />

      <div className="mt-4 grid gap-2">
        {activeWithLocation.map((c) => (
          <div key={c.id} className="flex items-center gap-3 bg-white rounded-lg border p-3 text-sm">
            <Truck size={16} className="text-blue-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 truncate">{c.name}</p>
              <p className="text-xs text-gray-500">{c.vehicle || '-'}</p>
            </div>
            <span className="text-xs text-gray-400">
              {c.last_location_at ? new Date(c.last_location_at).toLocaleTimeString('id-ID') : '-'}
            </span>
          </div>
        ))}
        {activeWithLocation.length === 0 && !loading && (
          <p className="text-center text-gray-400 py-8">Belum ada kurir dengan lokasi aktif</p>
        )}
      </div>
    </div>
  );
}
