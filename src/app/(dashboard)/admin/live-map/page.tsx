'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

interface CourierLocation {
  id: number;
  name: string;
  phone: string;
  photoUrl: string | null;
  vehicle: string | null;
  platNo: string | null;
  lastLat: string | null;
  lastLng: string | null;
  lastLocationAt: string | null;
  isOnShift: boolean;
}

const vehicleIcon = (vehicle: string | null) => {
  if (vehicle === 'mobil') return '🚗';
  return '🏍️';
};

export default function LiveMapPage() {
  const [couriers, setCouriers] = useState<CourierLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [L, setL] = useState<any>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    import('leaflet').then((l) => {
      delete (l.Icon.Default.prototype as any)._getIconUrl;
      l.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      setL(l);
    });
  }, []);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/couriers/live-locations');
      const json = await res.json();
      if (json.ok) setCouriers(json.data);
    } catch (e) {
      console.error('Gagal fetch live locations', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLocations();
    const interval = setInterval(fetchLocations, 30000);
    return () => clearInterval(interval);
  }, [fetchLocations]);

  useEffect(() => {
    if (!L || !mapRef.current || couriers.length === 0) return;

    const map = L.map(mapRef.current).setView([-5.147665, 119.432732], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/">OSM</a>',
    }).addTo(map);

    const markers: any[] = [];
    couriers.forEach((c) => {
      if (!c.lastLat || !c.lastLng) return;
      const marker = L.marker([Number(c.lastLat), Number(c.lastLng)])
        .addTo(map)
        .bindPopup(`
          <div class="text-sm">
            <strong>${vehicleIcon(c.vehicle)} ${c.name}</strong><br/>
            ${c.platNo ? c.platNo + '<br/>' : ''}
            ${c.lastLocationAt ? new Date(c.lastLocationAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : ''}
          </div>
        `);
      markers.push(marker);
    });

    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.1));
    }

    return () => map.remove();
  }, [L, couriers]);

  const filtered = couriers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Live Map</h1>
        <Badge variant={couriers.length > 0 ? 'default' : 'secondary'}>
          {couriers.length} Kurir Aktif
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 space-y-3">
          <Input
            placeholder="Cari kurir..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Tidak ada kurir aktif dengan lokasi
              </p>
            ) : (
              filtered.map(c => (
                <Card key={c.id} className={c.isOnShift ? 'border-l-4 border-l-emerald-500' : 'opacity-60'}>
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {vehicleIcon(c.vehicle)} {c.name}
                      {c.isOnShift && <Badge variant="outline" className="text-xs">Shift</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
                    <p>{c.phone} {c.platNo ? `• ${c.platNo}` : ''}</p>
                    {c.lastLocationAt && (
                      <p className="text-[10px]">
                        {new Date(c.lastLocationAt).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-3 h-[70vh] rounded-lg border overflow-hidden bg-muted/20">
          <div ref={mapRef} className="h-full w-full" />
          {!L && (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Memuat peta...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
