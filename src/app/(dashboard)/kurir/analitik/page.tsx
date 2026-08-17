'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, RefreshCw, TrendingUp, PackageCheck, AlertTriangle, Wallet } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/ui/skeleton';

interface KpiRow {
  id: number;
  courierId: number;
  kpiDate: string;
  totalAssigned: number;
  totalDelivered: number;
  totalFailed: number;
  onTimeRate: number | null;
  totalEarnings: number;
}

export default function AnalitikPage() {
  const { addToast } = useToast();
  const [kpi, setKpi] = useState<KpiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/kpi');
      if (res.ok) {
        const data = await res.json();
        setKpi(data.kpi || []);
      }
    } catch {
      addToast('error', 'Gagal memuat KPI');
    }
    setLoading(false);
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  async function compute() {
    setComputing(true);
    try {
      const res = await fetch('/api/admin/kpi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast('success', `KPI ${date} dihitung (${data.data?.computed ?? 0} kurir)`);
        load();
      } else {
        addToast('error', data.error || 'Gagal hitung KPI');
      }
    } catch {
      addToast('error', 'Gagal hitung KPI');
    }
    setComputing(false);
  }

  const today = kpi.filter((k) => k.kpiDate === date);
  const totalEarnings = kpi.reduce((s, k) => s + k.totalEarnings, 0);
  const totalDelivered = kpi.reduce((s, k) => s + k.totalDelivered, 0);
  const totalFailed = kpi.reduce((s, k) => s + k.totalFailed, 0);
  const avgOnTime = today.length
    ? today.reduce((s, k) => s + (k.onTimeRate ?? 0), 0) / today.length
    : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-orange-600" />
          <h1 className="text-xl font-bold text-gray-800">Analitik Kurir</h1>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            data-testid="analitik-date-input"
          />
          <Button onClick={compute} disabled={computing} className="bg-orange-600 hover:bg-orange-700">
            <RefreshCw className={`w-4 h-4 mr-1 ${computing ? 'animate-spin' : ''}`} />
            {computing ? 'Menghitung...' : 'Hitung KPI'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
          <div>
            <div className="text-2xl font-bold text-gray-800">{totalDelivered.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Total Terkirim</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center"><PackageCheck className="w-5 h-5 text-amber-600" /></div>
          <div>
            <div className="text-2xl font-bold text-gray-800">{avgOnTime.toFixed(0)}%</div>
            <div className="text-xs text-gray-500">On-Time {date}</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
          <div>
            <div className="text-2xl font-bold text-gray-800">{totalFailed.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Total Gagal</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><Wallet className="w-5 h-5 text-blue-600" /></div>
          <div>
            <div className="text-2xl font-bold text-gray-800">{rupiah(totalEarnings)}</div>
            <div className="text-xs text-gray-500">Total Earnings</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3"><CardSkeleton /></div>
      ) : kpi.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          Belum ada data KPI. Klik &quot;Hitung KPI&quot; untuk meng-agregasi data {date}.
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left p-3 font-medium text-gray-600">Tanggal</th>
                <th className="text-left p-3 font-medium text-gray-600">Kurir ID</th>
                <th className="text-right p-3 font-medium text-gray-600">Dikirim</th>
                <th className="text-right p-3 font-medium text-gray-600">Terkirim</th>
                <th className="text-right p-3 font-medium text-gray-600">Gagal</th>
                <th className="text-right p-3 font-medium text-gray-600">On-Time</th>
                <th className="text-right p-3 font-medium text-gray-600">Earnings</th>
              </tr>
            </thead>
            <tbody>
              {kpi.slice(0, 100).map((k) => (
                <tr key={k.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-3 text-gray-600 text-xs">{k.kpiDate}</td>
                  <td className="p-3 font-medium">#{k.courierId}</td>
                  <td className="p-3 text-right text-gray-700">{k.totalAssigned}</td>
                  <td className="p-3 text-right font-medium text-emerald-600">{k.totalDelivered}</td>
                  <td className="p-3 text-right text-red-600">{k.totalFailed}</td>
                  <td className="p-3 text-right">{k.onTimeRate != null ? `${k.onTimeRate.toFixed(0)}%` : '–'}</td>
                  <td className="p-3 text-right font-medium">{rupiah(k.totalEarnings)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const rupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
