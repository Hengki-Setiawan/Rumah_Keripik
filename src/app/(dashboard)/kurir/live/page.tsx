'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, MapPin, Navigation, Phone, RefreshCw, Search, ShieldCheck, Truck, Wifi, WifiOff } from 'lucide-react';

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

function timeAgo(dateString: string | null): string {
  if (!dateString) return 'Belum ada data';
  const diffSec = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (diffSec < 10) return 'Baru saja';
  if (diffSec < 60) return `${diffSec} dtk lalu`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour} jam lalu`;
}

export default function LiveCourierMapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersMapRef = useRef<Map<number, any>>(new Map());
  const [couriers, setCouriers] = useState<CourierLocation[]>([]);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('reconnecting');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourierId, setSelectedCourierId] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  async function load() {
    try {
      const res = await fetch('/api/admin/couriers');
      const data = await res.json();
      setCouriers(data.couriers || []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  // Connect to SSE Live Stream
  useEffect(() => {
    load();
    let es: EventSource | null = null;
    let retryTimer: NodeJS.Timeout | null = null;

    function connect() {
      if (es) es.close();
      setConnectionStatus('reconnecting');
      es = new EventSource('/api/admin/couriers/live-stream');

      es.onopen = () => {
        setConnectionStatus('connected');
      };

      es.addEventListener('live', (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          if (data?.couriers) {
            setCouriers(data.couriers);
            setLoading(false);
            setConnectionStatus('connected');
          }
        } catch { /* ignore frame parsing error */ }
      });

      es.onerror = () => {
        setConnectionStatus('reconnecting');
        es?.close();
        retryTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      if (es) es.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    let isMounted = true;

    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      if (!mapRef.current || !isMounted) return;

      mapInstance.current = L.map(mapRef.current, {
        center: [-5.105950, 119.432407],
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapInstance.current);

      // Warehouse Hub Marker
      const gudangIcon = L.divIcon({
        html: `
          <div class="flex items-center gap-1.5 bg-[#c55a2b] text-white px-2.5 py-1 rounded-full shadow-md text-xs font-bold border-2 border-white">
            <span class="w-2 h-2 rounded-full bg-white animate-pulse"></span>
            Gudang Utama
          </div>
        `,
        className: '',
        iconSize: [110, 26],
        iconAnchor: [55, 13],
      });

      L.marker([-5.105950, 119.432407], { icon: gudangIcon })
        .addTo(mapInstance.current)
        .bindPopup(`
          <div class="p-1">
            <p class="font-bold text-[#c55a2b] text-sm">Rumah Produksi & Gudang Utama</p>
            <p class="text-xs text-gray-600 mt-0.5">Kaluku Bodoa, Tallo, Makassar</p>
          </div>
        `);
    })();

    return () => {
      isMounted = false;
      mapInstance.current?.remove();
      mapInstance.current = null;
      markersMapRef.current.clear();
    };
  }, []);

  // Smooth Marker Updates without Flickering
  useEffect(() => {
    if (!mapInstance.current) return;

    (async () => {
      const L = (await import('leaflet')).default;
      const currentIds = new Set<number>();

      for (const c of couriers) {
        if (!c.last_lat || !c.last_lng) continue;
        const lat = parseFloat(c.last_lat);
        const lng = parseFloat(c.last_lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        currentIds.add(c.id);

        const initials = c.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'K';
        const isOnline = c.last_location_at && (Date.now() - new Date(c.last_location_at).getTime()) < 120_000;

        const courierIcon = L.divIcon({
          html: `
            <div class="relative group cursor-pointer transition-transform hover:scale-110">
              <div class="w-8 h-8 rounded-full ${isOnline ? 'bg-blue-600' : 'bg-gray-500'} text-white flex items-center justify-center font-bold text-xs border-2 border-white shadow-lg">
                ${initials}
              </div>
              <span class="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'} border-2 border-white"></span>
            </div>
          `,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const popupContent = `
          <div class="p-1.5 min-w-[180px]">
            <div class="flex items-center gap-2 mb-1.5">
              <div class="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                ${initials}
              </div>
              <div>
                <p class="font-bold text-gray-900 text-sm leading-tight">${c.name}</p>
                <p class="text-[11px] text-gray-500">${c.vehicle || 'Sepeda Motor'}</p>
              </div>
            </div>
            <div class="text-xs space-y-1 text-gray-600 pt-1 border-t border-gray-100">
              <p class="flex items-center gap-1.5"><span class="text-gray-400">📞</span> ${c.phone}</p>
              <p class="flex items-center gap-1.5"><span class="text-gray-400">⏱️</span> ${timeAgo(c.last_location_at)}</p>
            </div>
          </div>
        `;

        if (markersMapRef.current.has(c.id)) {
          // UPDATE EXISTING MARKER SMOOTHLY
          const existingMarker = markersMapRef.current.get(c.id);
          existingMarker.setLatLng([lat, lng]);
          existingMarker.setIcon(courierIcon);
          const popup = existingMarker.getPopup();
          if (popup) popup.setContent(popupContent);
        } else {
          // CREATE NEW MARKER
          const newMarker = L.marker([lat, lng], { icon: courierIcon })
            .addTo(mapInstance.current)
            .bindPopup(popupContent);

          newMarker.on('click', () => setSelectedCourierId(c.id));
          markersMapRef.current.set(c.id, newMarker);
        }
      }

      // Cleanup removed markers
      for (const [id, marker] of markersMapRef.current.entries()) {
        if (!currentIds.has(id)) {
          marker.remove();
          markersMapRef.current.delete(id);
        }
      }
    })();
  }, [couriers]);

  // Filter couriers
  const activeWithLocation = useMemo(() => {
    return couriers.filter((c) => c.is_active && c.last_lat && c.last_lng);
  }, [couriers]);

  const filteredCouriers = useMemo(() => {
    if (!searchQuery.trim()) return activeWithLocation;
    const q = searchQuery.toLowerCase();
    return activeWithLocation.filter((c) =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.vehicle && c.vehicle.toLowerCase().includes(q))
    );
  }, [activeWithLocation, searchQuery]);

  function focusCourier(courier: CourierLocation) {
    if (!courier.last_lat || !courier.last_lng || !mapInstance.current) return;
    const lat = parseFloat(courier.last_lat);
    const lng = parseFloat(courier.last_lng);
    mapInstance.current.flyTo([lat, lng], 15, { duration: 1.2 });
    setSelectedCourierId(courier.id);
    const marker = markersMapRef.current.get(courier.id);
    if (marker) marker.openPopup();
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Lokasi Kurir Realtime</h1>
            <p className="text-xs text-gray-500">Live GPS tracking armada pengantaran Rumah Keripik</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Realtime Stream Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold">
            {connectionStatus === 'connected' ? (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-700">Live Streaming (Upstash Redis)</span>
              </>
            ) : connectionStatus === 'reconnecting' ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                <span className="text-amber-700">Menghubungkan...</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-rose-700">Terputus</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-200 p-3.5 shadow-sm">
          <p className="text-2xl font-black text-blue-600">{activeWithLocation.length}</p>
          <p className="text-xs font-medium text-gray-500 mt-0.5">Kurir Berkoordinat Live</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-3.5 shadow-sm">
          <p className="text-2xl font-black text-gray-900">{couriers.filter((c) => c.is_active).length}</p>
          <p className="text-xs font-medium text-gray-500 mt-0.5">Total Kurir Aktif</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-3.5 shadow-sm">
          <p className="text-2xl font-black text-emerald-600">
            {couriers.filter((c) => c.last_location_at && (currentTime - new Date(c.last_location_at).getTime()) < 120_000).length}
          </p>
          <p className="text-xs font-medium text-gray-500 mt-0.5">Online &lt; 2 Menit</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-3.5 shadow-sm">
          <p className="text-2xl font-black text-[#c55a2b]">1</p>
          <p className="text-xs font-medium text-gray-500 mt-0.5">Gudang Utama (Tallo)</p>
        </div>
      </div>

      {/* Main Grid: Map (Left) & Courier Panel (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map Container */}
        <div className="lg:col-span-2 relative bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm h-[520px]">
          <div ref={mapRef} className="w-full h-full" />
        </div>

        {/* Courier Sidebar List */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col h-[520px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <Truck size={16} className="text-blue-600" />
              Daftar Armada Kurir
            </h3>
            <span className="text-xs text-gray-400 font-medium">{filteredCouriers.length} Kurir</span>
          </div>

          {/* Search Box */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Cari nama / nopol / telepon..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Scrollable Courier List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredCouriers.map((c) => {
              const isOnline = c.last_location_at && (currentTime - new Date(c.last_location_at).getTime()) < 120_000;
              const isSelected = selectedCourierId === c.id;

              return (
                <div
                  key={c.id}
                  className={`p-3 rounded-xl border transition-all ${
                    isSelected ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <p className="font-semibold text-gray-900 text-xs truncate">{c.name}</p>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">{c.vehicle || 'Sepeda Motor'} • {c.phone}</p>
                      <p className="text-[10px] text-gray-400 mt-1">Update: {timeAgo(c.last_location_at)}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => focusCourier(c)}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-600 text-gray-700 text-xs font-semibold flex items-center gap-1 shadow-xs transition shrink-0"
                    >
                      <Crosshair size={12} />
                      Fokus
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredCouriers.length === 0 && !loading && (
              <div className="text-center py-12 text-gray-400 text-xs">
                <MapPin className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                <p>Tidak ada kurir yang cocok</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
