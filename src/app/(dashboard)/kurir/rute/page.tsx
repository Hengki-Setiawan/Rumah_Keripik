'use client';

import { useState, useEffect, useCallback } from 'react';
import { Route as RouteIcon, RefreshCw, MapPinned } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface RouteStop {
  assignmentId: number;
  id_transaksi: string;
  kurir_id: number | null;
  kurir_name: string | null;
  status: string;
  pickup_at: string | null;
  delivered_at: string | null;
  kode_pesanan: string | null;
  nama_penerima: string | null;
  alamat_penerima: string | null;
  route_date: string | null;
  sequence_no: number | null;
  stop_status: string | null;
  created_at: string | null;
}

const statusColor: Record<string, string> = {
  Siap_Dikirim: 'bg-amber-100 text-amber-700',
  Dalam_Pengiriman: 'bg-blue-100 text-blue-700',
  Terkirim: 'bg-green-100 text-green-700',
  Gagal: 'bg-red-100 text-red-700',
};

export default function RutePage() {
  const { addToast } = useToast();
  const [routes, setRoutes] = useState<RouteStop[]>([]);
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
      const res = await fetch('/api/admin/routes', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        addToast('success', 'Optimasi rute selesai');
        load();
      } else {
        addToast('error', data.error || 'Gagal optimasi');
      }
    } catch {
      addToast('error', 'Gagal optimasi');
    }
    setOptimizing(false);
  }

  const grouped = routes.reduce<Record<string, RouteStop[]>>((acc, r) => {
    const key = String(r.kurir_id || 0);
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const sortedKeys = Object.keys(grouped).sort((a, b) => (Number(a) || 0) - (Number(b) || 0));

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <RouteIcon className="w-6 h-6 text-orange-600" />
          <h1 className="text-xl font-bold text-gray-800">Rute Pengiriman</h1>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            data-testid="rute-date-input"
          />
          <Button onClick={optimizeAll} disabled={optimizing} className="bg-orange-600 hover:bg-orange-700">
            <RefreshCw className={`w-4 h-4 mr-1 ${optimizing ? 'animate-spin' : ''}`} />
            {optimizing ? 'Optimasi...' : 'Optimasi Semua'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3"><CardSkeleton /><CardSkeleton /></div>
      ) : routes.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Belum ada rute untuk tanggal ini.</div>
      ) : (
        <div className="space-y-6">
          {sortedKeys.map((key) => {
            const stops = grouped[key];
            const name = stops[0]?.kurir_name || 'Belum ada kurir';
            return (
              <div key={key} className="bg-white rounded-xl border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                  <div className="flex items-center gap-2">
                    <MapPinned className="w-4 h-4 text-orange-600" />
                    <span className="font-semibold text-gray-800">{name}</span>
                    <Badge variant="secondary">{stops.length} stop</Badge>
                  </div>
                  <span className="text-xs text-gray-400">{date}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white border-b">
                      <th className="text-left p-2.5 font-medium text-gray-500 text-xs">#</th>
                      <th className="text-left p-2.5 font-medium text-gray-500 text-xs">Kode</th>
                      <th className="text-left p-2.5 font-medium text-gray-500 text-xs">Penerima</th>
                      <th className="text-left p-2.5 font-medium text-gray-500 text-xs">Alamat</th>
                      <th className="text-left p-2.5 font-medium text-gray-500 text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stops
                      .slice()
                      .sort((a, b) => (a.sequence_no ?? 999) - (b.sequence_no ?? 999))
                      .map((s) => (
                        <tr key={s.assignmentId} className="border-b last:border-0">
                          <td className="p-2.5 font-mono text-xs text-gray-500">{s.sequence_no ?? '–'}</td>
                          <td className="p-2.5 font-medium">{s.kode_pesanan || s.id_transaksi}</td>
                          <td className="p-2.5">{s.nama_penerima || '–'}</td>
                          <td className="p-2.5 text-xs text-gray-500 max-w-xs truncate">{s.alamat_penerima || '–'}</td>
                          <td className="p-2.5">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[s.status] || 'bg-gray-100 text-gray-600'}`}>
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
