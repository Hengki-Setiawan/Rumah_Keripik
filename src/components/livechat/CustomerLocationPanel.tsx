'use client';

import { MapPin, ExternalLink } from 'lucide-react';
import dynamic from 'next/dynamic';

const MiniMap = dynamic(
  () => import('@/components/maps/MiniDeliveryMap').then((mod) => ({ default: mod.MiniDeliveryMap })),
  {
    ssr: false,
    loading: () => <div className="h-28 bg-muted animate-pulse rounded-lg" />,
  }
);

interface CustomerLocationPanelProps {
  lat?: string | null;
  lng?: string | null;
  alamat?: string | null;
  mapsLink?: string | null;
}

export function CustomerLocationPanel({ lat, lng, alamat, mapsLink }: CustomerLocationPanelProps) {
  if (!lat || !lng) return null;

  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);
  if (isNaN(numLat) || isNaN(numLng)) return null;

  return (
    <div className="border rounded-xl p-3 bg-card space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MapPin size={16} className="text-primary shrink-0" />
        <span>Lokasi Pelanggan</span>
      </div>

      {alamat && (
        <p className="text-xs text-muted-foreground leading-relaxed">{alamat}</p>
      )}

      <div className="rounded-lg overflow-hidden">
        <MiniMap lat={numLat} lng={numLng} height={112} />
      </div>

      {mapsLink && (
        <a
          href={mapsLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
        >
          <ExternalLink size={12} />
          Buka di Google Maps
        </a>
      )}
    </div>
  );
}
