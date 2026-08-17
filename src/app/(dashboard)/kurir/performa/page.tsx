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
  status: string;
  note?: string | null;
  createdAt: string;
}

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

  const totalPenjualan = earnings.reduce((a, e) => a + e.baseFee, 0);

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
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-gray-500">Pengiriman</p>
              <p className="mt-1 text-lg font-bold text-gray-800">{earnings.length}</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-gray-500">Total Nilai Penjualan</p>
              <p className="mt-1 text-lg font-bold text-emerald-600">{rupiah(totalPenjualan)}</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-gray-500">Rata-rata per Pengiriman</p>
              <p className="mt-1 text-lg font-bold text-gray-800">{earnings.length ? rupiah(Math.round(totalPenjualan / earnings.length)) : rupiah(0)}</p>
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
                    <th className="text-right p-3 font-medium text-gray-600">Nilai Penjualan</th>
                    <th className="text-left p-3 font-medium text-gray-600">Catatan</th>
                    <th className="text-left p-3 font-medium text-gray-600">Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.map((e) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="p-3 text-gray-500">#{e.id}</td>
                      <td className="p-3 text-right font-bold text-gray-800">{rupiah(e.baseFee + e.bonusAmount)}</td>
                      <td className="p-3 text-gray-500 text-xs">{e.note || '-'}</td>
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
