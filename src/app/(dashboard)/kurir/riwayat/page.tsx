'use client';

import { useState, useEffect, useCallback } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardSkeleton } from '@/components/ui/skeleton';

interface Courier {
  id: number;
  name: string;
}

interface RouteRow {
  assignmentId: number;
  id_transaksi: string;
  kurir_name: string | null;
  status: string;
  kode_pesanan: string | null;
  nama_penerima: string | null;
  route_date: string | null;
  sequence_no: number | null;
  stop_status: string | null;
  delivered_at: string | null;
}

export default function RiwayatPage() {
  const { addToast } = useToast();
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [courierId, setCourierId] = useState<string>('');
  const [routeDate, setRouteDate] = useState('');
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCouriers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/couriers');
      if (res.ok) {
        const data = await res.json();
        setCouriers((data.couriers || []).map((c: { id: number; name: string }) => ({ id: c.id, name: c.name })));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadCouriers(); }, [loadCouriers]);

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (courierId) params.set('courierId', courierId);
      if (routeDate) params.set('routeDate', routeDate);
      const res = await fetch(`/api/admin/routes?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRoutes(data.routes || []);
      }
    } catch {
      addToast('error', 'Gagal memuat riwayat rute');
    }
    setLoading(false);
  }, [courierId, routeDate, addToast]);

  useEffect(() => { loadRoutes(); }, [loadRoutes]);

  const statusColor: Record<string, string> = {
    Siap_Dikirim: 'bg-gray-100 text-gray-600',
    Dalam_Pengiriman: 'bg-blue-100 text-blue-700',
    Terkirim: 'bg-emerald-100 text-emerald-700',
    Gagal: 'bg-red-100 text-red-700',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <History className="w-6 h-6 text-orange-600" />
          <h1 className="text-xl font-bold text-gray-800">Riwayat Rute Pengiriman</h1>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <select
          value={courierId}
          onChange={(e) => setCourierId(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">Semua kurir</option>
          {couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Input type="date" value={routeDate} onChange={(e) => setRouteDate(e.target.value)} className="w-44" />
        <Button variant="outline" onClick={loadRoutes}><RefreshCw className="w-4 h-4 mr-1" /> Muat</Button>
      </div>

      {loading ? (
        <div className="space-y-3"><CardSkeleton /><CardSkeleton /></div>
      ) : routes.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Belum ada riwayat rute.</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left p-3 font-medium text-gray-600">Kurir</th>
                <th className="text-left p-3 font-medium text-gray-600">Pesanan</th>
                <th className="text-left p-3 font-medium text-gray-600">Penerima</th>
                <th className="text-left p-3 font-medium text-gray-600">Tanggal Rute</th>
                <th className="text-right p-3 font-medium text-gray-600">Urutan</th>
                <th className="text-right p-3 font-medium text-gray-600">Stop</th>
                <th className="text-center p-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r) => (
                <tr key={`${r.assignmentId}-${r.sequence_no}`} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-3 font-medium">{r.kurir_name ?? '-'}</td>
                  <td className="p-3 text-gray-600">{r.kode_pesanan ?? r.id_transaksi}</td>
                  <td className="p-3 text-gray-600">{r.nama_penerima ?? '-'}</td>
                  <td className="p-3 text-gray-500">{r.route_date ?? '-'}</td>
                  <td className="p-3 text-right text-gray-700">{r.sequence_no ?? '-'}</td>
                  <td className="p-3 text-right text-gray-700">{r.stop_status ?? '-'}</td>
                  <td className="p-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[r.status] ?? 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}