'use client';

import { useEffect, useState } from 'react';
import { BarChart3, DollarSign, CreditCard, TrendingDown, TrendingUp, Download } from 'lucide-react';

interface CategoryInfo { id: string; name: string; type: string }
interface ReportData {
  periodStart: string; periodEnd: string;
  totalRevenue: number; totalExpenses: number; totalRefunds: number;
  netProfit: number; entryCount: number;
  expenseByCategory: Record<string, number>;
  entries: Array<{ id: string; entryType: string; amount: number; categoryId?: string; note?: string; createdAt: string }>;
  categories?: CategoryInfo[];
}

export default function KeuanganPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
  });
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/ledger/report?periodStart=${periodStart}&periodEnd=${periodEnd}`)
      .then((r) => r.json()).then((data) => { if (data.ok) setReport(data); })
      .finally(() => setLoading(false));
  }, [periodStart, periodEnd]);

  const catName = (id?: string) => {
    if (!id || !report?.categories) return '-';
    return report.categories.find((c) => c.id === id)?.name || id.slice(0, 8);
  };

  if (loading) return <div className="p-6 text-gray-500">Memuat laporan keuangan...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 /> Keuangan</h1>

      <div className="flex gap-3 items-center">
        <label className="text-sm">Dari:</label>
        <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="border rounded px-2 py-1 text-sm" />
        <label className="text-sm">Sampai:</label>
        <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="border rounded px-2 py-1 text-sm" />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <DollarSign size={20} className="text-emerald-500 mb-1" />
          <div className="text-2xl font-bold">Rp {(report?.totalRevenue || 0).toLocaleString()}</div>
          <div className="text-sm text-gray-500">Pendapatan</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <CreditCard size={20} className="text-red-500 mb-1" />
          <div className="text-2xl font-bold">Rp {(report?.totalExpenses || 0).toLocaleString()}</div>
          <div className="text-sm text-gray-500">Biaya</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <TrendingDown size={20} className="text-orange-500 mb-1" />
          <div className="text-2xl font-bold">Rp {(report?.totalRefunds || 0).toLocaleString()}</div>
          <div className="text-sm text-gray-500">Refund</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <TrendingUp size={20} className={`mb-1 ${(report?.netProfit || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
          <div className="text-2xl font-bold">Rp {(report?.netProfit || 0).toLocaleString()}</div>
          <div className="text-sm text-gray-500">Laba Bersih</div>
        </div>
      </div>

      {report?.expenseByCategory && Object.keys(report.expenseByCategory).length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h2 className="font-semibold mb-3">Biaya per Kategori</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th>Kategori</th><th>Jumlah</th></tr></thead>
            <tbody>
              {Object.entries(report.expenseByCategory).map(([id, amount]) => (
                <tr key={id} className="border-t"><td className="py-2">{catName(id)}</td><td className="py-2 font-medium">Rp {amount.toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <h2 className="font-semibold mb-3">Entry Terbaru</h2>
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th>Tipe</th><th>Jumlah</th><th>Kategori</th><th>Catatan</th><th>Tanggal</th></tr></thead>
            <tbody>
              {(report?.entries || []).slice(0, 20).map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="py-2"><span className={`px-2 py-0.5 rounded text-xs ${e.entryType === 'revenue' ? 'bg-emerald-100 text-emerald-700' : e.entryType === 'expense' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{e.entryType}</span></td>
                  <td className="py-2 font-medium">Rp {Math.abs(e.amount).toLocaleString()}</td>
                  <td className="py-2">{catName(e.categoryId)}</td>
                  <td className="py-2 text-gray-500 max-w-xs truncate">{e.note || '-'}</td>
                  <td className="py-2 text-gray-500">{e.createdAt?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
