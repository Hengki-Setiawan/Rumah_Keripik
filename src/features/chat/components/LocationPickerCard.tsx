'use client';

import { useEffect, useRef, useState } from 'react';
import { LocateFixed, MapPin, Navigation } from 'lucide-react';
import type { LocationPickerComponent } from '@/lib/chat-v3/types';

type LeafletModule = typeof import('leaflet');

const DEFAULT_LAT = -5.1340;
const DEFAULT_LNG = 119.4135;

const cardClass = 'rounded-[1.7rem] border border-[#f0dfca] bg-[rgba(255,250,244,0.9)] p-4 shadow-[0_14px_34px_rgba(47,36,28,0.05)] backdrop-blur';
const secondaryButtonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#ecd8bf] bg-white px-4 py-2 text-sm font-medium text-[#2f241c] transition hover:bg-[#f7eddf]';
const primaryButtonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#c55a2b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#ae4d23]';
const inputClass = 'w-full rounded-[1.2rem] border border-[#ecd8bf] bg-white px-4 py-3 text-sm text-[#2f241c] outline-none transition placeholder:text-[#9ca3af] focus:border-[#c55a2b]/30 focus:ring-4 focus:ring-[#c55a2b]/5';

export function LocationPickerCard({ component, onSend }: { component: LocationPickerComponent; onSend: (message: string) => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<import('leaflet').Map | null>(null);
  const markerRef = useRef<import('leaflet').Marker | null>(null);
  const [showMap, setShowMap] = useState(component.mode === 'manual_pick');
  const [selected, setSelected] = useState<{ lat: number; lng: number } | null>(null);
  const [addressText, setAddressText] = useState('');

  function useLocation() {
    if (!navigator.geolocation) {
      onSend('Browser saya tidak mendukung lokasi, saya isi alamat manual');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        setSelected(point);
        onSend(`Lokasi saya: ${point.lat}, ${point.lng}`);
      },
      () => onSend('Saya belum bisa kirim lokasi, saya isi alamat manual')
    );
  }

  function sendManualAddress() {
    const trimmed = addressText.trim();
    if (trimmed.length >= 8) onSend(`Alamat saya: ${trimmed}`);
  }

  useEffect(() => {
    if (!showMap || !mapRef.current || mapInstance.current) return;
    let cancelled = false;

    async function initMap() {
      const L: LeafletModule = (await import('leaflet')).default as unknown as LeafletModule;
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [selected?.lat || DEFAULT_LAT, selected?.lng || DEFAULT_LNG],
        zoom: 13,
        zoomControl: true,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      const icon = L.divIcon({
        html: '<div style="background:#c55a2b;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>',
        className: '',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      function setMarker(lat: number, lng: number) {
        setSelected({ lat, lng });
        if (!markerRef.current) {
          markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(map).bindPopup('Titik pengiriman');
          markerRef.current.on('dragend', () => {
            const pos = markerRef.current?.getLatLng();
            if (pos) setSelected({ lat: pos.lat, lng: pos.lng });
          });
        } else {
          markerRef.current.setLatLng([lat, lng]);
        }
      }

      map.on('click', (event: import('leaflet').LeafletMouseEvent) => setMarker(event.latlng.lat, event.latlng.lng));
      if (selected) setMarker(selected.lat, selected.lng);
      mapInstance.current = map;
    }

    initMap();
    return () => {
      cancelled = true;
      markerRef.current = null;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [showMap, selected]);

  return (
    <div className={cardClass} data-testid="location-picker-card">
      <div className="mb-3 flex items-center gap-2"><MapPin size={18} className="text-[#c55a2b]" /><h3 className="font-semibold text-[#2f241c]">Lokasi pengiriman</h3></div>
      <p className="text-sm leading-6 text-[#6b7280]">Kirim titik lokasi saat ini, pilih titik di peta, atau ketik alamat lengkap beserta patokan rumah.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {component.mode !== 'manual_pick' && <button type="button" data-testid="location-use-current" onClick={useLocation} className={primaryButtonClass}><LocateFixed size={15} /> Gunakan lokasi saat ini</button>}
        {component.mode !== 'current_location' && <button type="button" data-testid="location-open-map" onClick={() => setShowMap((value) => !value)} className={secondaryButtonClass}><Navigation size={15} /> Pilih di peta</button>}
      </div>
      {showMap && (
        <div className="mt-4 space-y-3">
          <div ref={mapRef} className="h-64 overflow-hidden rounded-2xl border border-[#ecd8bf] bg-[#f7eddf]" />
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#fbf2e7] p-3 text-xs text-[#6b7280]">
            <span>{selected ? `Titik dipilih: ${selected.lat.toFixed(6)}, ${selected.lng.toFixed(6)}` : 'Klik peta atau drag marker untuk memilih titik.'}</span>
            <button type="button" data-testid="location-send-point" disabled={!selected} onClick={() => selected && onSend(`Lokasi saya: ${selected.lat}, ${selected.lng}`)} className="min-h-10 rounded-full bg-[#c55a2b] px-4 py-2 font-medium text-white transition hover:bg-[#ae4d23] disabled:bg-[#d7c8ba]">Kirim titik</button>
          </div>
        </div>
      )}
      <div className="mt-4 space-y-2">
        <textarea
          data-testid="location-address-text"
          value={addressText}
          onChange={(event) => setAddressText(event.target.value)}
          placeholder="Tulis alamat lengkap + patokan rumah di sini..."
          className={`${inputClass} min-h-20`}
        />
        <button type="button" data-testid="location-send-address" disabled={addressText.trim().length < 8} onClick={sendManualAddress} className={`${primaryButtonClass} w-full`}>
          Kirim alamat
        </button>
      </div>
    </div>
  );
}