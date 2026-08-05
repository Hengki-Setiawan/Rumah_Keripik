'use client';

import { useState, useEffect, useCallback } from 'react';
import { ReceiptText, Download, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardSkeleton } from '@/components/ui/skeleton';

interface PayrollRow {
  courierId: number;
  courierName: string | null;
  totalDeliveryFee: number;
  totalBonus: number;
  total: number;
  deliveryCount: number;
  confirmedCount: number;
  paidOutCount: number;
  totalShifts: number;
  totalDistanceKm: number;
}

interface PayrollResponse {
  ok: boolean;
  period: string;
  payroll: PayrollRow[];
  summary: {
    courierCount: number;
    totalDeliveryFee: number;
    totalBonus: number;
    total: number;
    totalDeliveries: number;
  };
}

const rupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

export default function PayrollPage() {
  const { addToast } = useToast();
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data, setData] = useState<PayrollResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payroll/calculate?period=${period}`);
      if (!res.ok) throw new Error('Gagal');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setData(json);
    } catch {
      addToast('error', 'Gagal memuat payroll');
    }
    setLoading(false);
  }, [period, addToast]);

  useEffect(() => { load(); }, [load]);

  function exportCsv() {
    if (!data) return;
    const header = 'Kurir,TotalFee,Bonus,Total,Delivery,Konfirmasi,Dibayar,Shift,JarakKm';
    const lines = data.payroll.map((p) =>
      [p.courierName ?? `Kurir#${p.courierId}`, p.totalDeliveryFee, p.totalBonus, p.total, p.deliveryCount, p.confirmedCount, p.paidOutCount, p.totalShifts, p.totalDistanceKm].join(',')
    );
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `payroll-${period}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <ReceiptText className="w-6 h-6 text-orange-600" />
          <h1 className="text-xl font-bold text-gray-800">Payroll Kurir</h1>
        </div>
        <div className="flex items-center gap-2">
          <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44" />
          <Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Muat</Button>
          <Button variant="outline" onClick={exportCsv} disabled={!data}><Download className="w-4 h-4 mr-1" /> CSV</Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3"><CardSkeleton /><CardSkeleton /></div>
      ) : !data ? (
        <div className="text-center py-12 text-gray-400">Pilih periode untuk memuat payroll.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Kurir', value: data.summary.courierCount },
              { label: 'Total Fee Pengiriman', value: rupiah(data.summary.totalDeliveryFee) },
              { label: 'Total Bonus', value: rupiah(data.summary.totalBonus) },
              { label: 'Total Dibayar', value: rupiah(data.summary.total), highlight: true },
              { label: 'Total Pengiriman', value: data.summary.totalDeliveries },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl border bg-white p-4 ${s.highlight ? 'border-orange-300 ring-1 ring-orange-200' : ''}`}>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`mt-1 text-lg font-bold ${s.highlight ? 'text-orange-600' : 'text-gray-800'}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {data.payroll.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Belum ada pendapatan kurir di periode ini.</div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left p-3 font-medium text-gray-600">Kurir</th>
                    <th className="text-right p-3 font-medium text-gray-600">Fee</th>
                    <th className="text-right p-3 font-medium text-gray-600">Bonus</th>
                    <th className="text-right p-3 font-medium text-gray-600">Total</th>
                    <th className="text-right p-3 font-medium text-gray-600">Delivery</th>
                    <th className="text-right p-3 font-medium text-gray-600">Konfirmasi</th>
                    <th className="text-right p-3 font-medium text-gray-600">Dibayar</th>
                    <th className="text-right p-3 font-medium text-gray-600">Shift</th>
                    <th className="text-right p-3 font-medium text-gray-600">Jarak (km)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payroll.map((p) => (
                    <tr key={p.courierId} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="p-3 font-medium">{p.courierName ?? `Kurir#${p.courierId}`}</td>
                      <td className="p-3 text-right text-gray-700">{rupiah(p.totalDeliveryFee)}</td>
                      <td className="p-3 text-right text-gray-700">{rupiah(p.totalBonus)}</td>
                      <td className="p-3 text-right font-bold text-orange-700">{rupiah(p.total)}</td>
                      <td className="p-3 text-right text-gray-700">{p.deliveryCount}</td>
                      <td className="p-3 text-right text-gray-700">{p.confirmedCount}</td>
                      <td className="p-3 text-right text-gray-700">{p.paidOutCount}</td>
                      <td className="p-3 text-right text-gray-700">{p.totalShifts}</td>
                      <td className="p-3 text-right text-gray-700">{Math.round(p.totalDistanceKm * 10) / 10}</td>
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