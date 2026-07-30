'use client';

import { useEffect, useRef, useState } from 'react';
import { Bike, Navigation } from 'lucide-react';

interface CourierTrackingMapProps {
  orderId: string;
  destinationLat: string;
  destinationLng: string;
  destinationLabel?: string;
  height?: number;
}

interface CourierData {
  name: string;
  photoUrl: string | null;
  phone: string;
  platNo: string | null;
  vehicle: string | null;
  lastLat: string | null;
  lastLng: string | null;
}

const GUDANG_LAT = -5.1340;
const GUDANG_LNG = 119.4135;

export function CourierTrackingMap({
  orderId,
  destinationLat,
  destinationLng,
  destinationLabel,
  height = 320,
}: CourierTrackingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const courierMarkerRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);
  const gudangMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const courierRouteLineRef = useRef<any>(null);
  const [courier, setCourier] = useState<CourierData | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let mounted = true;
    let eventSource: EventSource | null = null;

    async function init() {
      if (!mapRef.current) return;
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (!mounted || !mapRef.current) return;

      if (!mapInstanceRef.current) {
        const destLat = parseFloat(destinationLat);
        const destLng = parseFloat(destinationLng);

        const map = L.map(mapRef.current, {
          center: [(destLat + GUDANG_LAT) / 2, (destLng + GUDANG_LNG) / 2],
          zoom: 13,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OSM',
          maxZoom: 19,
        }).addTo(map);

        const destIcon = L.divIcon({
          html: '<div style="background:#22c55e;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"><div style="background:#22c55e;width:8px;height:8px;border-radius:50%;margin:2px auto 0"></div></div>',
          className: '',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

        const destMarker = L.marker([destLat, destLng], { icon: destIcon })
          .addTo(map)
          .bindPopup(`<b>${destinationLabel || 'Tujuan'}</b>`);
        destinationMarkerRef.current = destMarker;

        const gudangIcon = L.divIcon({
          html: '<div style="background:#ef4444;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:9px;color:white;font-weight:bold">G</div>',
          className: '',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

        const gudangMarker = L.marker([GUDANG_LAT, GUDANG_LNG], { icon: gudangIcon })
          .addTo(map)
          .bindPopup('<b>Gudang Rumah Keripik</b>');
        gudangMarkerRef.current = gudangMarker;

        const line = L.polyline(
          [[GUDANG_LAT, GUDANG_LNG], [destLat, destLng]],
          { color: '#6b7280', weight: 2, dashArray: '8,6', opacity: 0.4 },
        ).addTo(map);
        routeLineRef.current = line;

        const bounds = L.latLngBounds([[GUDANG_LAT, GUDANG_LNG], [destLat, destLng]]);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });

        mapInstanceRef.current = map;
      }

      // Connect SSE
      eventSource = new EventSource(`/api/tracking/${orderId}`);

      eventSource.onopen = () => {
        if (mounted) setConnected(true);
      };

      eventSource.addEventListener('tracking', (event) => {
        if (!mounted) return;
        try {
          const data = JSON.parse(event.data);
          if (!data.ok) return;

          const courierData = data.courier;
          setCourier(courierData);

          const map = mapInstanceRef.current;
          if (!map) return;

          if (courierData?.lastLat && courierData?.lastLng) {
            const lat = parseFloat(courierData.lastLat);
            const lng = parseFloat(courierData.lastLng);

            if (!isNaN(lat) && !isNaN(lng)) {
              if (!courierMarkerRef.current) {
                const courierIcon = L.divIcon({
                  html: '<div style="background:#3b82f6;width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center"><div style="background:#3b82f6;width:10px;height:10px;border-radius:50%"></div></div>',
                  className: '',
                  iconSize: [22, 22],
                  iconAnchor: [11, 11],
                });

                const marker = L.marker([lat, lng], { icon: courierIcon })
                  .addTo(map)
                  .bindPopup(`<b>${courierData.name}</b><br>${courierData.platNo || '-'}<br>${courierData.vehicle || '-'}`);
                courierMarkerRef.current = marker;

                const routeLine = L.polyline(
                  [[lat, lng], [parseFloat(destinationLat), parseFloat(destinationLng)]],
                  { color: '#3b82f6', weight: 3, opacity: 0.7 },
                ).addTo(map);
                courierRouteLineRef.current = routeLine;
              } else {
                courierMarkerRef.current.setLatLng([lat, lng]);

                if (courierRouteLineRef.current) {
                  courierRouteLineRef.current.setLatLngs([
                    [lat, lng],
                    [parseFloat(destinationLat), parseFloat(destinationLng)],
                  ]);
                }
              }
            }
          }

          if (data.events?.length > 0) {
            const latestLocation = data.events.find((e: any) => e.eventType === 'courier_location' && e.lat && e.lng);
            if (latestLocation && (!courierData?.lastLat || !courierData?.lastLng)) {
              const lat = parseFloat(latestLocation.lat);
              const lng = parseFloat(latestLocation.lng);
              if (!isNaN(lat) && !isNaN(lng) && !courierMarkerRef.current) {
                const map = mapInstanceRef.current;
                if (map) {
                  const courierIcon = L.divIcon({
                    html: '<div style="background:#3b82f6;width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>',
                    className: '',
                    iconSize: [22, 22],
                    iconAnchor: [11, 11],
                  });
                  const marker = L.marker([lat, lng], { icon: courierIcon }).addTo(map);
                  courierMarkerRef.current = marker;
                }
              }
            }
          }
        } catch {}
      });

      eventSource.onerror = () => {
        if (mounted) setConnected(false);
      };
    }

    init();

    return () => {
      mounted = false;
      if (eventSource) eventSource.close();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      courierMarkerRef.current = null;
      courierRouteLineRef.current = null;
    };
  }, [orderId, destinationLat, destinationLng, destinationLabel]);

  return (
    <div className="space-y-3">
      {courier && (
        <div className="flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-white">
            <Bike className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-blue-900 truncate">{courier.name}</p>
            <p className="text-blue-700 text-xs">
              {courier.platNo && `${courier.platNo} • `}{courier.vehicle || ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-600 font-medium text-xs">
            <Navigation className="h-3.5 w-3.5" />
            {connected ? 'Live' : 'Menyambung...'}
          </div>
        </div>
      )}
      <div
        ref={mapRef}
        style={{ height: `${height}px` }}
        className="w-full rounded-xl border border-outline-variant/20 overflow-hidden"
      />
    </div>
  );
}
