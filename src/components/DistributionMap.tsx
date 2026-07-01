'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Info, Navigation, Truck } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';

// Coordinates for Makassar (Rumah Kripik base)
const WAREHOUSE_COORDS = { lat: -5.147665, lng: 119.432731, name: 'Gudang Pusat Rumah Kripik' };

interface CustomerLocation {
  id: string;
  nama: string;
  no_wa: string;
  alamat: string;
  lat: number;
  lng: number;
  tipe: 'pelanggan';
}

interface WarungLocation {
  id: string;
  nama: string;
  pemilik: string;
  alamat: string;
  lat: number;
  lng: number;
  tipe: 'warung';
  tipeKemitraan: string;
}

interface DistributionMapProps {
  customers: any[];
  warungs: any[];
}

export default function DistributionMap({ customers, warungs }: DistributionMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapInst = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<{
    destName: string;
    distance: number;
    duration: number;
    cost: number;
    coords: [number, number];
  } | null>(null);

  // Generate deterministic coordinates around Makassar based on ID/no_wa to make it look realistic
  const getCoords = (seed: string, offsetMultiplier: number = 1) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Offset max +/- 0.05 degrees (around 5-10 km)
    const latOffset = ((Math.abs(hash) % 1000) / 10000 - 0.05) * offsetMultiplier;
    const lngOffset = (((Math.abs(hash) >> 3) % 1000) / 10000 - 0.05) * offsetMultiplier;
    return {
      lat: WAREHOUSE_COORDS.lat + latOffset,
      lng: WAREHOUSE_COORDS.lng + lngOffset,
    };
  };

  const activeCustomersList: CustomerLocation[] = customers
    .filter(c => c.alamat_pengiriman)
    .map(c => {
      const realLat = Number(c.latest_lat);
      const realLng = Number(c.latest_lng);
      const hasRealCoords = Number.isFinite(realLat) && Number.isFinite(realLng);
      const coords = hasRealCoords ? { lat: realLat, lng: realLng } : getCoords(c.no_wa_pelanggan, 0.7);
      return {
        id: c.no_wa_pelanggan,
        nama: c.nama_pelanggan || 'Pelanggan Chatbot',
        no_wa: c.no_wa_pelanggan,
        alamat: c.alamat_pengiriman,
        lat: coords.lat,
        lng: coords.lng,
        tipe: 'pelanggan',
      };
    });

  const warungsList: WarungLocation[] = warungs
    .filter(w => w.alamat)
    .map(w => {
      const coords = getCoords(w.id_warung, 0.4);
      return {
        id: w.id_warung,
        nama: w.nama_warung,
        pemilik: w.pemilik || 'Partner',
        alamat: w.alamat,
        lat: coords.lat,
        lng: coords.lng,
        tipe: 'warung',
        tipeKemitraan: w.tipe_kemitraan,
      };
    });

  // Dynamic Leaflet script and stylesheet loader
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Load CSS
    const linkId = 'leaflet-css';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Load JS
    const scriptId = 'leaflet-js';
    const initMap = () => {
      const L = (window as any).L;
      if (!L || !mapRef.current || leafletMapInst.current) return;

      // Create map instance
      const map = L.map(mapRef.current).setView([WAREHOUSE_COORDS.lat, WAREHOUSE_COORDS.lng], 13);
      leafletMapInst.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // Warehouse Icon (Gold/Red Pin)
      const warehouseIcon = L.divIcon({
        className: 'custom-warehouse-pin',
        html: `<div class="w-10 h-10 bg-primary text-white border-2 border-white rounded-full flex items-center justify-center shadow-lg transform -translate-y-2"><span class="font-bold text-[10px]">BASE</span></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      // Customer Icon (Green Pin)
      const customerIcon = L.divIcon({
        className: 'custom-customer-pin',
        html: `<div class="w-7 h-7 bg-green-600 text-white border-2 border-white rounded-full flex items-center justify-center shadow-md transform -translate-y-1"><span class="font-bold text-[9px]">CS</span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      // Warung Icon (Purple Pin)
      const warungIcon = L.divIcon({
        className: 'custom-warung-pin',
        html: `<div class="w-7 h-7 bg-purple-600 text-white border-2 border-white rounded-full flex items-center justify-center shadow-md transform -translate-y-1"><span class="font-bold text-[9px]">WRG</span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      // Add Warehouse Marker
      L.marker([WAREHOUSE_COORDS.lat, WAREHOUSE_COORDS.lng], { icon: warehouseIcon })
        .addTo(map)
        .bindPopup(`<b>${WAREHOUSE_COORDS.name}</b><br/>Pusat Produksi & Pengiriman`);

      // Add Customer Markers
      activeCustomersList.forEach((cust) => {
        const marker = L.marker([cust.lat, cust.lng], { icon: customerIcon }).addTo(map);
        marker.bindPopup(`
          <div class="space-y-1">
            <p class="font-bold text-sm text-gray-900">${cust.nama}</p>
            <p class="text-xs text-gray-500 font-mono">${cust.no_wa}</p>
            <p class="text-xs text-gray-700">${cust.alamat}</p>
            <a href="https://www.google.com/maps/search/?api=1&query=${cust.lat},${cust.lng}" target="_blank" rel="noopener noreferrer" class="block mt-1 text-[11px] text-blue-600 underline">
              Buka Google Maps
            </a>
            <button onclick="window.dispatchRouteSelect('${cust.nama}', ${cust.lat}, ${cust.lng})" class="mt-2 w-full text-center py-1 bg-primary text-white text-[11px] font-medium rounded hover:opacity-90">
              Analisis Rute
            </button>
          </div>
        `);
      });

      // Add Warung Markers
      warungsList.forEach((wrg) => {
        const marker = L.marker([wrg.lat, wrg.lng], { icon: warungIcon }).addTo(map);
        marker.bindPopup(`
          <div class="space-y-1">
            <p class="font-bold text-sm text-purple-900">${wrg.nama}</p>
            <p class="text-xs text-gray-500">Pemilik: ${wrg.pemilik}</p>
            <p class="text-xs text-gray-700">${wrg.alamat}</p>
            <span class="inline-block px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold">${wrg.tipeKemitraan}</span>
            <button onclick="window.dispatchRouteSelect('${wrg.nama}', ${wrg.lat}, ${wrg.lng})" class="mt-2 w-full text-center py-1 bg-purple-600 text-white text-[11px] font-medium rounded hover:opacity-90">
              Analisis Rute
            </button>
          </div>
        `);
      });

      setMapLoaded(true);
    };

    // Global action dispatcher for buttons inside popup strings
    (window as any).dispatchRouteSelect = (name: string, lat: number, lng: number) => {
      // Simple Haversine calculation for straight line distance
      const R = 6371; // km
      const dLat = ((lat - WAREHOUSE_COORDS.lat) * Math.PI) / 180;
      const dLon = ((lng - WAREHOUSE_COORDS.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((WAREHOUSE_COORDS.lat * Math.PI) / 180) *
          Math.cos((lat * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      // Mock duration and delivery cost calculations
      const duration = Math.round(distance * 2.5 + 5); // minutes
      const cost = Math.max(5000, Math.round(distance * 3500)); // IDR

      setSelectedRoute({
        destName: name,
        distance: parseFloat(distance.toFixed(2)),
        duration,
        cost,
        coords: [lat, lng],
      });
    };

    if (!(window as any).L) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = initMap;
      document.body.appendChild(script);
    } else {
      initMap();
    }

    return () => {
      if (leafletMapInst.current) {
        leafletMapInst.current.remove();
        leafletMapInst.current = null;
      }
      delete (window as any).dispatchRouteSelect;
    };
  }, [customers, warungs]);

  // Render polyline route overlay when route is selected
  useEffect(() => {
    const map = leafletMapInst.current;
    if (!map || !selectedRoute) return;

    // Clear any existing polylines
    map.eachLayer((layer: any) => {
      if (layer instanceof (window as any).L.Polyline && !(layer instanceof (window as any).L.Polygon)) {
        map.removeLayer(layer);
      }
    });

    const L = (window as any).L;
    if (L) {
      // Draw route line
      const routePoints = [
        [WAREHOUSE_COORDS.lat, WAREHOUSE_COORDS.lng] as [number, number],
        selectedRoute.coords,
      ];
      const polyline = L.polyline(routePoints, {
        color: '#8d4b00',
        weight: 4,
        dashArray: '8, 8',
        opacity: 0.8,
      }).addTo(map);

      // Fit map bounds slightly to show the full route
      map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    }
  }, [selectedRoute]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
      {/* Route & Distribution Analysis Side Panel */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-primary font-bold">
            <Truck size={20} />
            <h3 className="font-headline-sm text-[16px]">Informasi Distribusi</h3>
          </div>

          <div className="space-y-3 font-body-md text-body-md text-on-surface-variant">
            <div className="flex justify-between border-b border-outline-variant/10 pb-2">
              <span>Lokasi Gudang:</span>
              <span className="font-bold text-on-surface text-right">Makassar, Center</span>
            </div>
            <div className="flex justify-between border-b border-outline-variant/10 pb-2">
              <span>Titik Pelanggan (Map):</span>
              <span className="font-bold text-green-700">{activeCustomersList.length} Pin</span>
            </div>
            <div className="flex justify-between border-b border-outline-variant/10 pb-2">
              <span>Warung Retail (Map):</span>
              <span className="font-bold text-purple-700">{warungsList.length} Pin</span>
            </div>
          </div>
        </div>

        {selectedRoute ? (
          <div className="bg-surface-container-lowest border border-primary-fixed rounded-xl p-5 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-bold">
                <Navigation size={18} className="animate-bounce" />
                <h4 className="font-label-md text-label-md">Analisis Rute & Ongkir</h4>
              </div>
              <button
                onClick={() => setSelectedRoute(null)}
                className="text-xs text-on-surface-variant hover:text-on-surface"
              >
                Clear
              </button>
            </div>

            <div className="space-y-3 font-body-md text-body-md text-on-surface-variant">
              <div>
                <p className="font-caption text-caption uppercase tracking-wider text-outline">Tujuan</p>
                <p className="font-bold text-on-surface text-sm mt-0.5">{selectedRoute.destName}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <p className="font-caption text-caption text-outline">Jarak Jalur Lurus</p>
                  <p className="font-headline-sm text-[18px] font-bold text-on-surface">{selectedRoute.distance} km</p>
                </div>
                <div>
                  <p className="font-caption text-caption text-outline">Estimasi Waktu</p>
                  <p className="font-headline-sm text-[18px] font-bold text-on-surface">~{selectedRoute.duration} Menit</p>
                </div>
              </div>
              <div className="pt-2 border-t border-outline-variant/20">
                <p className="font-caption text-caption text-outline">Perkiraan Biaya Kirim</p>
                <p className="text-xl font-bold text-primary">{formatRupiah(selectedRoute.cost)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-surface-cream border border-orange-200 rounded-xl p-5 flex items-start gap-3">
            <Info size={20} className="text-primary shrink-0 mt-0.5" />
            <div className="font-body-md text-body-md text-on-surface-variant space-y-1">
              <p className="font-bold text-on-surface">Petunjuk Navigasi</p>
              <p className="text-xs leading-relaxed">
                Klik salah satu pin pelanggan atau warung retail di peta, kemudian pilih <b>&quot;Analisis Rute&quot;</b> untuk menghitung rute, estimasi jarak tempuh, waktu kirim, serta estimasi ongkos kirim dari Gudang Utama.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Map Element */}
      <div className="lg:col-span-8">
        <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-2 shadow-sm overflow-hidden h-[450px] relative">
          {!mapLoaded && (
            <div className="absolute inset-0 bg-surface-container/50 backdrop-blur-sm z-30 flex flex-col items-center justify-center">
              <div className="w-10 h-10 border-b-2 border-primary rounded-full animate-spin mb-2" />
              <p className="font-label-md text-on-surface-variant">Memuat Peta Distribusi...</p>
            </div>
          )}
          <div ref={mapRef} className="w-full h-full rounded-lg z-10" />
        </div>
      </div>
    </div>
  );
}
