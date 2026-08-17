'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Route as RouteIcon, RefreshCw, MapPinned, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface RouteStop {
  id: number;
  idTransaksi: string;
  sequenceNo: number;
  lat: string | null;
  lng: string | null;
  address: string | null;
  stopStatus: string | null;
  kodePesanan: string | null;
  penerima: string | null;
  orderStatus: string | null;
  paymentStatus: string | null;
}

interface DeliveryRoute {
  id: number;
  routeName: string;
  routeDate: string;
  status: string;
  courierId: number | null;
  courierName: string | null;
  warehouseName: string | null;
  stopCount: number;
  estimatedDistanceKm: string | null;
  createdAt: string;
  stops: RouteStop[];
}

const routeStatusColor: Record<string, string> = {
  open: 'bg-emerald-100 text-emerald-700',
  claimed: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function RutePage() {
  const { addToast } = useToast();
  const [routes, setRoutes] = useState<DeliveryRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [optimizing, setOptimizing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = date ? `?routeDate=${date}` : '';
      const res = await fetch(`/api/admin/routes${qs}`);
      if (res.ok) {
        const data = await res.json();
        setRoutes(data.routes || []);
      }
    } catch {
      addToast('error', 'Gagal memuat rute');
    }
    setLoading(false);
  }, [date, addToast]);

  useEffect(() => { load(); }, [load]);

  async function optimizeAll() {
    setOptimizing(true);
    try {
      const res = await fetch(`/api/admin/routes?routeDate=${date}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto: true }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast('success', `Auto-buat jalur selesai (${data.data?.routesCreated ?? 0} jalur)`);
        load();
      } else {
        addToast('error', data.error || 'Gagal auto-buat jalur');
      }
    } catch {
      addToast('error', 'Gagal auto-buat jalur');
    }
    setOptimizing(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <RouteIcon className="w-6 h-6 text-orange-600" />
          <h1 className="text-xl font-bold text-gray-800">Jalur Pengiriman</h1>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            data-testid="rute-date-input"
          />
          <Button onClick={optimizeAll} disabled={optimizing} className="bg-orange-600 hover:bg-orange-700" data-testid="rute-optimize-all-button">
            <RefreshCw className={`w-4 h-4 mr-1 ${optimizing ? 'animate-spin' : ''}`} />
            {optimizing ? 'Membuat...' : 'Auto-Buat Jalur'}
          </Button>
          <Link href="/kurir/jalur" className="inline-flex items-center text-sm text-orange-600 font-medium hover:underline">
            Kelola Jalur <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3"><CardSkeleton /><CardSkeleton /></div>
      ) : routes.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          Belum ada jalur untuk tanggal ini. Klik &quot;Auto-Buat Jalur&quot; untuk membentuk jalur dari pesanan processing.
        </div>
      ) : (
        <div className="space-y-6">
          {routes.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <MapPinned className="w-4 h-4 text-orange-600" />
                  <span className="font-semibold text-gray-800">{r.routeName}</span>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${routeStatusColor[r.status] || 'bg-gray-100 text-gray-600'}`}>
                    {r.status}
                  </span>
                  <Badge variant="secondary">{r.stopCount} stop</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {r.courierName ? <span className="text-gray-600 font-medium">{r.courierName}</span> : <span>Belum ada kurir</span>}
                  {r.estimatedDistanceKm ? <span>~{r.estimatedDistanceKm} km</span> : null}
                  <Link href={`/kurir/jalur?routeDate=${r.routeDate}`} className="text-orange-600 font-medium hover:underline">
                    Detail
                  </Link>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white border-b">
                    <th className="text-left p-2.5 font-medium text-gray-500 text-xs">#</th>
                    <th className="text-left p-2.5 font-medium text-gray-500 text-xs">Kode</th>
                    <th className="text-left p-2.5 font-medium text-gray-500 text-xs">Penerima</th>
                    <th className="text-left p-2.5 font-medium text-gray-500 text-xs">Alamat</th>
                  </tr>
                </thead>
                <tbody>
                  {r.stops.map((s) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="p-2.5 font-mono text-xs text-gray-500">{s.sequenceNo}</td>
                      <td className="p-2.5 font-medium">{s.kodePesanan || s.idTransaksi}</td>
                      <td className="p-2.5">{s.penerima || '–'}</td>
                      <td className="p-2.5 text-xs text-gray-500 max-w-xs truncate">{s.address || '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}