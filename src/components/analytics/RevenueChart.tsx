'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface ChartData {
  hari: string;
  omzet: number;
  transaksi: number;
}

export function RevenueChart() {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'line' | 'bar'>('line');

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/analytics/revenue/chart');
        if (res.ok) {
          const raw = await res.json();
          const mapped = raw.map((d: any) => {
            const date = new Date(d.tanggal + 'T00:00:00');
            const hari = date.toLocaleDateString('id-ID', { weekday: 'short' });
            return { hari, omzet: d.omzet || 0, transaksi: d.jumlah_transaksi || d.transaksi || 0 };
          });
          setData(mapped);
        }
      } catch (err) {
        console.error('[RevenueChart]', err);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  function formatRupiah(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
  }

  if (loading) {
    return <div className="animate-pulse h-72 bg-surface-container rounded-xl" />;
  }

  if (data.length === 0) {
    return (
      <div className="h-72 flex flex-col items-center justify-center text-on-surface-variant bg-surface-container-lowest border rounded-xl">
        <TrendingUp size={36} className="text-outline-variant mb-2" />
        <p className="text-sm">Belum ada data penjualan 7 hari terakhir</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-label-md text-label-md text-on-surface">Grafik Omzet & Transaksi</h3>
          <p className="text-xs text-on-surface-variant">7 hari terakhir</p>
        </div>
        <div className="flex gap-1 bg-surface-container rounded-lg p-0.5">
          <button onClick={() => setMode('line')} className={`px-3 py-1 rounded-md text-xs font-label-md transition-colors ${mode === 'line' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>Line</button>
          <button onClick={() => setMode('bar')} className={`px-3 py-1 rounded-md text-xs font-label-md transition-colors ${mode === 'bar' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>Bar</button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        {mode === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="hari" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${(v / 1000).toFixed(0)}rb` : String(v)} />
            <Tooltip formatter={(value: number) => formatRupiah(value)} />
            <Legend />
            <Line type="monotone" dataKey="omzet" stroke="#8B5CF6" strokeWidth={2} name="Omzet" dot={{ r: 3 }} />
            <Line type="monotone" dataKey="transaksi" stroke="#10B981" strokeWidth={2} name="Transaksi" dot={{ r: 3 }} />
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="hari" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${(v / 1000).toFixed(0)}rb` : String(v)} />
            <Tooltip formatter={(value: number) => formatRupiah(value)} />
            <Legend />
            <Bar dataKey="omzet" fill="#8B5CF6" name="Omzet" radius={[4, 4, 0, 0]} />
            <Bar dataKey="transaksi" fill="#10B981" name="Transaksi" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
