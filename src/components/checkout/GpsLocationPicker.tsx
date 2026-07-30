'use client';

import React, { useState } from 'react';
import { MapPin, Navigation, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface GpsLocationPickerProps {
  onLocationSelected: (data: {
    lat: number | null;
    lng: number | null;
    addressText: string;
    landmark?: string;
    source: 'gps' | 'manual';
  }) => void;
  initialAddress?: string;
}

export default function GpsLocationPicker({ onLocationSelected, initialAddress = '' }: GpsLocationPickerProps) {
  const [loadingGps, setLoadingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [latLng, setLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [addressText, setAddressText] = useState(initialAddress);
  const [landmark, setLandmark] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);

  const handleGetGpsLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Browser Anda tidak mendukung GPS Geolocation.');
      return;
    }

    setLoadingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLatLng({ lat, lng });

        try {
          // Reverse geocode via Nominatim OSM (Free / Public)
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            { headers: { 'User-Agent': 'RumahKeripik-App' } }
          );
          const data = await res.json();
          if (data && data.display_name) {
            setAddressText(data.display_name);
          } else {
            setAddressText(`Lokasi GPS (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
          }
        } catch (err) {
          setAddressText(`Lokasi GPS (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
        } finally {
          setLoadingGps(false);
        }
      },
      (error) => {
        setLoadingGps(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError('Izin lokasi ditolak. Silakan ketik alamat secara manual.');
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsError('Sinyal GPS tidak tersedia.');
            break;
          case error.TIMEOUT:
            setGpsError('Waktu permintaan lokasi habis.');
            break;
          default:
            setGpsError('Gagal mendeteksi lokasi GPS.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleConfirmAddress = () => {
    if (!addressText.trim()) {
      setGpsError('Alamat pengiriman wajib diisi.');
      return;
    }
    setIsConfirmed(true);
    onLocationSelected({
      lat: latLng ? latLng.lat : null,
      lng: latLng ? latLng.lng : null,
      addressText: addressText.trim(),
      landmark: landmark.trim() || undefined,
      source: latLng ? 'gps' : 'manual',
    });
  };

  return (
    <div className="bg-gray-900/80 border border-amber-500/30 rounded-xl p-4 sm:p-5 shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-amber-400" />
          Tahap 2: Alamat Pengiriman
        </h3>
        {latLng && (
          <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/40 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> GPS Terdeteksi
          </span>
        )}
      </div>

      <p className="text-xs text-gray-300 mb-4">
        Gunakan lokasi GPS Anda untuk rekomendasi pengiriman terakurat, atau ketik alamat secara manual.
      </p>

      {/* 1-Klik GPS Button */}
      <button
        type="button"
        onClick={handleGetGpsLocation}
        disabled={loadingGps}
        className="w-full mb-4 py-2.5 px-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-gray-950 font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
      >
        {loadingGps ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Mendeteksi Koordinat Presisi...
          </>
        ) : (
          <>
            <Navigation className="w-4 h-4" /> 📍 Gunakan Lokasi GPS Saya (1-Klik)
          </>
        )}
      </button>

      {gpsError && (
        <div className="mb-4 p-3 bg-red-950/60 border border-red-500/40 rounded-lg flex items-start gap-2 text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Manual or Auto-filled Address Input */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">Alamat Lengkap / Detail Jalan</label>
          <textarea
            value={addressText}
            onChange={(e) => {
              setAddressText(e.target.value);
              setIsConfirmed(false);
            }}
            rows={3}
            placeholder="Contoh: Jl. Merdeka No. 45, RT 02/05, Kel. Sukamaju, Bandung"
            className="w-full px-3 py-2.5 bg-gray-950 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">Patokan / Catatan Kurir (Opsional)</label>
          <input
            type="text"
            value={landmark}
            onChange={(e) => setLandmark(e.target.value)}
            placeholder="Contoh: Pagar hijau depan toko kelontong"
            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        <button
          type="button"
          onClick={handleConfirmAddress}
          className={`w-full py-2.5 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
            isConfirmed
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'
              : 'bg-amber-500 hover:bg-amber-400 text-gray-950 shadow-amber-900/40'
          }`}
        >
          {isConfirmed ? (
            <>
              <CheckCircle className="w-4 h-4" /> Alamat Dikonfirmasi
            </>
          ) : (
            'Simpan & Lanjut ke Pembayaran →'
          )}
        </button>
      </div>
    </div>
  );
}
