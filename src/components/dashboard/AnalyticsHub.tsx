'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DollarSign, ShoppingCart, Package, Bot, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { getAnalitikKPI, getRankingProduk, getAllTransaksi } from '@/actions/transaksi';
import { exportTransaksiCSV, getChatLogAnalytics } from '@/actions/export';
import { RevenueChart } from '@/components/analytics/RevenueChart';
import { KpiCardSkeleton } from '@/components/ui/skeleton';
import { ExportButton } from '@/components/ui/export-button';

export function AnalyticsHub() {
  const [kpi, setKpi] = useState({ totalOmzet: 0, totalTransaksi: 0, totalStok: 0, totalPelanggan: 0 });
  const [ranking, setRanking] = useState<{ id_produk: string; qty_total: number; nama_produk: string }[]>([]);
  const [transaksi, setTransaksi] = useState<any[]>([]);
  const [chatAnalytics, setChatAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [kpiData, rankingData, txData, chatData] = await Promise.all([
        getAnalitikKPI(),
        getRankingProduk(),
        getAllTransaksi(1, 50),
        getChatLogAnalytics(),
      ]);
      setKpi(kpiData);
      setRanking(rankingData);
      setTransaksi(txData.data || []);
      if (chatData.success) setChatAnalytics(chatData.data);
      setLoading(false);
    }
    fetchData().catch(console.error);
  }, []);

  function formatRupiah(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
  }

  const kpiCards = [
    { label: 'Total Omzet', value: formatRupiah(kpi.totalOmzet), icon: DollarSign, trend: '+12%', trendUp: true, iconBg: 'bg-primary-fixed text-primary', valueColor: 'text-primary', badgeClass: 'text-green-600 bg-green-50' },
    { label: 'Jumlah Transaksi', value: `${kpi.totalTransaksi} Pesanan`, icon: ShoppingCart, trend: '+8%', trendUp: true, iconBg: 'bg-secondary-fixed text-secondary', valueColor: 'text-secondary', badgeClass: 'text-green-600 bg-green-50' },
    { label: 'Total Qty Terjual', value: `${kpi.totalStok} Pcs`, icon: Package, trend: '-3%', trendUp: false, iconBg: 'bg-tertiary-fixed text-tertiary', valueColor: 'text-tertiary', badgeClass: 'text-red-600 bg-red-50' },
    { label: 'Pengguna Chatbot Aktif', value: `${kpi.totalPelanggan} User`, icon: Bot, trend: 'LIVE', trendUp: true, iconBg: 'bg-blue-100 text-bot-indigo', valueColor: 'text-bot-indigo', badgeClass: 'text-bot-indigo bg-indigo-50' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
          {[1, 2, 3, 4].map((i) => <KpiCardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          <div className="lg:col-span-8 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant">
            <div className="animate-pulse h-64 bg-surface-container-high rounded-lg" />
          </div>
          <div className="lg:col-span-4 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant">
            <div className="animate-pulse h-5 w-32 bg-surface-container-high rounded mb-6" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-16 bg-surface-container-high rounded-lg" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">Analitik & Keuangan</h3>
          <p className="text-on-surface-variant mt-1">Pantau omzet, ranking produk, performa percakapan, dan transaksi terbaru dari satu tempat.</p>
        </div>
        <ExportButton action={exportTransaksiCSV} label="Export Transaksi" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
        {kpiCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2 ${stat.iconBg} rounded-lg`}>
                  <Icon size={24} />
                </div>
                <span className={`font-caption text-caption ${stat.badgeClass} px-2 py-1 rounded-full flex items-center gap-1`}>
                  {stat.trendUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {stat.trend}
                </span>
              </div>
              <p className="text-on-surface-variant font-label-md text-label-md mb-1">{stat.label}</p>
              <p className={`font-headline-md text-headline-md font-bold ${stat.valueColor}`}>{stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <div className="lg:col-span-8">
          <RevenueChart />
        </div>

        <div className="lg:col-span-4 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant">
          <h3 className="font-headline-sm text-headline-sm text-on-surface mb-6">Produk Terlaris</h3>
          {ranking.length === 0 ? (
            <div className="text-center py-12 text-on-surface-variant font-body-md">Belum ada data penjualan</div>
          ) : (
            <div className="flex flex-col gap-4">
              {ranking.slice(0, 3).map((item, i) => {
                const rankColors = ['bg-primary-fixed text-primary', 'bg-secondary-fixed text-secondary', 'bg-tertiary-fixed text-tertiary'];
                const estimatedRevenue = item.qty_total * (i === 0 ? 15000 : i === 1 ? 12000 : 10000);
                return (
                  <div key={item.id_produk} className="flex items-center gap-4 p-3 bg-surface rounded-lg border border-outline-variant/30">
                    <div className={`w-12 h-12 rounded-lg ${rankColors[i]} flex items-center justify-center font-bold`}>#{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-label-md text-on-surface truncate">{item.nama_produk}</p>
                      <p className="font-caption text-caption text-on-surface-variant">{item.qty_total} Pcs Terjual</p>
                    </div>
                    <span className="font-bold text-primary font-headline-sm">{formatRupiah(estimatedRevenue)}</span>
                  </div>
                );
              })}
            </div>
          )}
          <Link href="/master-data/produk" className="w-full mt-6 py-2 text-primary font-label-md border border-primary-fixed-dim rounded-lg hover:bg-primary-fixed-dim transition-colors flex items-center justify-center gap-1">
            Lihat Semua Produk <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {chatAnalytics && (
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant">
          <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">Analitik Percakapan Bot</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Percakapan', value: chatAnalytics.total, color: 'text-primary' },
              { label: 'Auto Reply', value: chatAnalytics.rule, color: 'text-green-600' },
              { label: 'AI Groq/Gemini', value: chatAnalytics.groq + chatAnalytics.gemini, color: 'text-bot-indigo' },
              { label: 'Tidak Terjawab', value: chatAnalytics.notFound, color: 'text-error' },
            ].map((s, i) => (
              <div key={i} className="bg-surface-container-low rounded-xl p-4">
                <p className="font-caption text-caption text-on-surface-variant">{s.label}</p>
                <p className={`font-headline-md text-headline-md font-bold mt-1 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">Transaksi Terakhir</h3>
          <Link href="/transaksi" className="text-primary font-label-md hover:underline">Semua Transaksi</Link>
        </div>
        {transaksi.length === 0 ? (
          <div className="text-center py-8 text-on-surface-variant font-body-md">Belum ada transaksi</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container text-on-surface font-label-md uppercase text-[10px] tracking-wider">
                  <th className="px-6 py-3 rounded-tl-lg">ID Transaksi</th>
                  <th className="px-6 py-3">Waktu</th>
                  <th className="px-6 py-3">Pelanggan</th>
                  <th className="px-6 py-3">Total</th>
                  <th className="px-6 py-3 rounded-tr-lg">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {transaksi.slice(0, 8).map((tx: any) => (
                  <tr key={tx.id_transaksi} className="hover:bg-surface-cream transition-colors">
                    <td className="px-6 py-4 font-mono text-mono">#{tx.id_transaksi}</td>
                    <td className="px-6 py-4 text-on-surface-variant font-body-md">{tx.waktu_simpan ? new Date(tx.waktu_simpan).toLocaleString('id-ID') : '-'}</td>
                    <td className="px-6 py-4 font-medium font-body-md">{tx.nama_pelanggan || tx.nama_warung || '-'}</td>
                    <td className="px-6 py-4 font-bold text-primary font-body-md">{formatRupiah(tx.total_bayar)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full font-label-md text-[10px] ${
                        tx.status_pembayaran === 'Lunas' ? 'bg-green-100 text-green-700' :
                        tx.status_pembayaran === 'Piutang' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                      }`}>{tx.status_pembayaran}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
