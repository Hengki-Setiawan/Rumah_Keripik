'use client';

import { useState, useEffect } from 'react';
import { MapPin, TrendingUp, Package, Loader2 } from 'lucide-react';

interface ZoneStat {
  nama_zona: string;
  lat: number;
  lng: number;
  total_order: number;
  total_nilai: number;
}

interface ZoneStatsPanelProps {
  period?: 'today' | '7d' | '30d';
}

export function ZoneStatsPanel({ period = '7d' }: ZoneStatsPanelProps) {
  const [zones, setZones] = useState<ZoneStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchZones() {
      try {
        setLoading(true);
        const res = await fetch(`/api/analytics/location/zones?period=${period}`);
        if (res.ok) {
          const data = await res.json();
          setZones(data.zones || []);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchZones();
  }, [period]);

  function formatRupiah(n: number) {
    if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
    if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}rb`;
    return `Rp ${n}`;
  }

  const maxOrder = Math.max(...zones.map((z) => z.total_order), 1);

  const ZONE_COLORS = [
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-green-500',
    'bg-blue-500',
    'bg-purple-500',
  ];

  if (loading) {
    return (
      <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <MapPin size={16} className="text-primary" />
          <h3 className="font-label-md text-label-md text-on-surface">Statistik Zona Pengiriman</h3>
        </div>
        <div className="flex items-center justify-center py-8 text-on-surface-variant">
          <Loader2 size={24} className="animate-spin" />
        </div>
      </div>
    );
  }

  if (error || zones.length === 0) {
    return (
      <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <MapPin size={16} className="text-primary" />
          <h3 className="font-label-md text-label-md text-on-surface">Statistik Zona Pengiriman</h3>
        </div>
        <div className="text-center py-8 text-on-surface-variant">
          <MapPin size={36} className="mx-auto mb-2 text-outline-variant" />
          <p className="text-sm">
            {error
              ? 'Gagal memuat data zona'
              : 'Belum ada data zona pengiriman'}
          </p>
          <p className="text-xs mt-1">
            Data muncul setelah pelanggan mengirimkan lokasi saat order
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <MapPin size={16} className="text-primary" />
        <h3 className="font-label-md text-label-md text-on-surface">Statistik Zona Pengiriman</h3>
        <span className="ml-auto text-xs text-on-surface-variant">
          {period === 'today' ? 'Hari ini' : period === '7d' ? '7 hari' : '30 hari'}
        </span>
      </div>

      <div className="space-y-3">
        {zones.slice(0, 6).map((zone, i) => {
          const pct = Math.round((zone.total_order / maxOrder) * 100);
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-on-surface truncate max-w-[60%]">
                  {zone.nama_zona}
                </span>
                <div className="flex items-center gap-3 text-on-surface-variant shrink-0">
                  <span className="flex items-center gap-1">
                    <Package size={11} />
                    {zone.total_order} order
                  </span>
                  <span className="flex items-center gap-1 text-primary font-semibold">
                    <TrendingUp size={11} />
                    {formatRupiah(zone.total_nilai)}
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${ZONE_COLORS[i % ZONE_COLORS.length]}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {zones.length > 6 && (
        <p className="text-xs text-on-surface-variant text-center mt-3">
          +{zones.length - 6} zona lainnya
        </p>
      )}
    </div>
  );
}
