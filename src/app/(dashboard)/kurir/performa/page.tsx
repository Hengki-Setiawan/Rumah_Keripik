'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/ui/skeleton';

interface Courier {
  id: number;
  name: string;
  phone: string;
  vehicle: string | null;
  is_active: boolean;
}

interface EarningEntry {
  id: string;
  courierId: number;
  baseFee: number;
  bonusAmount: number;
  status: 'pending' | 'confirmed' | 'paid_out';
  createdAt: string;
}

const statusColor: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  paid_out: 'bg-blue-100 text-blue-700',
};

export default function PerformaPage() {
  const { addToast } = useToast();
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [earnings, setEarnings] = useState<EarningEntry[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCouriers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/couriers');
      if (res.ok) {
        const data = await res.json();
        setCouriers(data.couriers || []);
        if (data.couriers?.length) setSelectedId((prev) => prev ?? data.couriers[0].id);
      }
    } catch {
      addToast('error', 'Gagal memuat daftar kurir');
    }
  }, [addToast]);

  useEffect(() => { loadCouriers(); }, [loadCouriers]);

  const loadEarnings = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/courier-earnings?courierId=${selectedId}`);
      if (res.ok) {
        const data = await res.json();
        setEarnings(data.earnings || []);
      }
    } catch {
      addToast('error', 'Gagal memuat performa');
    }
    setLoading(false);
  }, [selectedId, addToast]);

  useEffect(() => { if (selectedId) loadEarnings(); }, [selectedId, loadEarnings]);

  const confirmed = earnings.filter((e) => e.status === 'confirmed');
  const pending = earnings.filter((e) => e.status === 'pending');
  const totalConfirmed = confirmed.reduce((a, e) => a + e.baseFee + e.bonusAmount, 0);
  const totalPending = pending.reduce((a, e) => a + e.baseFee + e.bonusAmount, 0);
  const onTimeRate = earnings.length ? Math.round((confirmed.length / earnings.length) * 100) : 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-orange-600" />
          <h1 className="text-xl font-bold text-gray-800">Performa Kurir</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedId ?? ''}
            onChange={(e) => setSelectedId(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {couriers.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.vehicle || 'motor'}){c.is_active ? '' : ' · nonaktif'}</option>
            ))}
          </select>
          <Button variant="outline" onClick={loadEarnings}><RefreshCw className="w-4 h-4 mr-1" /> Muat</Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3"><CardSkeleton /><CardSkeleton /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Pengiriman', value: earnings.length },
              { label: 'Terkonfirmasi', value: confirmed.length },
              { label: 'On-time Rate', value: `${onTimeRate}%` },
              { label: 'Menunggu Konfirmasi', value: pending.length },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border bg-white p-4">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="mt-1 text-lg font-bold text-gray-800">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-gray-500">Total Pendapatan Terkonfirmasi</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{rupiah(totalConfirmed)}</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-gray-500">Total Belum Dikonfirmasi</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">{rupiah(totalPending)}</p>
            </div>
          </div>

          {earnings.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Belum ada pendapatan untuk kurir ini.</div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left p-3 font-medium text-gray-600">ID</th>
                    <th className="text-right p-3 font-medium text-gray-600">Fee</th>
                    <th className="text-right p-3 font-medium text-gray-600">Bonus</th>
                    <th className="text-right p-3 font-medium text-gray-600">Total</th>
                    <th className="text-center p-3 font-medium text-gray-600">Status</th>
                    <th className="text-left p-3 font-medium text-gray-600">Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.map((e) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="p-3 text-gray-500">#{e.id}</td>
                      <td className="p-3 text-right text-gray-700">{rupiah(e.baseFee)}</td>
                      <td className="p-3 text-right text-gray-700">{rupiah(e.bonusAmount)}</td>
                      <td className="p-3 text-right font-bold text-gray-800">{rupiah(e.baseFee + e.bonusAmount)}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[e.status]}`}>{e.status}</span>
                      </td>
                      <td className="p-3 text-gray-500 text-xs">{new Date(e.createdAt).toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const rupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);