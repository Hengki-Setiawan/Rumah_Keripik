'use client';

import { useState, useEffect } from 'react';
import { getAnalitikKPI, getRankingProduk, getAllTransaksi, getOmzetHarian } from '@/actions/transaksi';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  DollarSign, ShoppingCart, Package, Bot, TrendingUp, TrendingDown, Download, ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { KpiCardSkeleton } from '@/components/ui/skeleton';
import { ExportButton } from '@/components/ui/export-button';
import { exportTransaksiCSV, getChatLogAnalytics } from '@/actions/export';

export default function AnalitikPage() {
  const [kpi, setKpi] = useState({ totalOmzet: 0, totalTransaksi: 0, totalStok: 0, totalPelanggan: 0 });
  const [ranking, setRanking] = useState<{ id_produk: string; qty_total: number; nama_produk: string }[]>([]);
  const [transaksi, setTransaksi] = useState<any[]>([]);
  const [omzetHarian, setOmzetHarian] = useState<{ tanggal: string; omzet: number; jumlah_transaksi: number }[]>([]);
  const [chatAnalytics, setChatAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [kpiData, rankingData, txData, omzetData, chatData] = await Promise.all([
        getAnalitikKPI(),
        getRankingProduk(),
        getAllTransaksi(1, 50),
        getOmzetHarian(),
        getChatLogAnalytics(),
      ]);
      setKpi(kpiData);
      setRanking(rankingData);
      setTransaksi(txData.data || []);
      setOmzetHarian(omzetData);
      if (chatData.success) setChatAnalytics(chatData.data);
      setLoading(false);
    }
    fetchData().catch(console.error);
  }, []);

  function formatRupiah(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
  }

  const chartData = omzetHarian.map((d) => {
    const date = new Date(d.tanggal + 'T00:00:00');
    const hari = date.toLocaleDateString('id-ID', { weekday: 'short' });
    return { hari, omzet: d.omzet, transaksi: d.jumlah_transaksi };
  });

  const hour = new Date().getHours();
  let greeting = 'Ikhtisar performa bisnis Rumah Kripik hari ini.';
  if (hour < 12) greeting = 'Selamat pagi! ' + greeting;
  else if (hour < 18) greeting = 'Selamat siang! ' + greeting;
  else greeting = 'Selamat malam! ' + greeting;

  const kpiCards = [
    {
      label: 'Total Omzet', value: formatRupiah(kpi.totalOmzet), icon: DollarSign,
      trend: '+12%', trendUp: true, iconBg: 'bg-primary-fixed text-primary',
      valueColor: 'text-primary', badgeClass: 'text-green-600 bg-green-50',
    },
    {
      label: 'Jumlah Transaksi', value: `${kpi.totalTransaksi} Pesanan`, icon: ShoppingCart,
      trend: '+8%', trendUp: true, iconBg: 'bg-secondary-fixed text-secondary',
      valueColor: 'text-secondary', badgeClass: 'text-green-600 bg-green-50',
    },
    {
      label: 'Total Qty Terjual', value: `${kpi.totalStok} Pcs`, icon: Package,
      trend: '-3%', trendUp: false, iconBg: 'bg-tertiary-fixed text-tertiary',
      valueColor: 'text-tertiary', badgeClass: 'text-red-600 bg-red-50',
    },
    {
      label: 'Pengguna Chatbot Aktif', value: `${kpi.totalPelanggan} User`, icon: Bot,
      trend: 'LIVE', trendUp: true, iconBg: 'bg-blue-100 text-bot-indigo',
      valueColor: 'text-bot-indigo', badgeClass: 'text-bot-indigo bg-indigo-50',
    },
  ];

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <div className="animate-pulse h-8 w-64 bg-surface-container-high rounded-lg mb-2" />
          <div className="animate-pulse h-4 w-96 bg-surface-container-high rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter mb-gutter">
          {[1,2,3,4].map((i) => <KpiCardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          <div className="lg:col-span-8 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant">
            <div className="animate-pulse h-64 bg-surface-container-high rounded-lg" />
          </div>
          <div className="lg:col-span-4 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant">
            <div className="animate-pulse h-5 w-32 bg-surface-container-high rounded mb-6" />
            <div className="space-y-3">
              {[1,2,3].map((i) => (
                <div key={i} className="animate-pulse flex items-center gap-4 p-3 bg-surface rounded-lg">
                  <div className="w-12 h-12 bg-surface-container-high rounded-lg" />
                  <div className="flex-1 space-y-1">
                    <div className="h-4 w-28 bg-surface-container-high rounded" />
                    <div className="h-3 w-20 bg-surface-container-high rounded" />
                  </div>
                  <div className="h-4 w-16 bg-surface-container-high rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Analitik & Keuangan</h2>
          <p className="text-on-surface-variant mt-1">{greeting}</p>
        </div>
        <div className="flex items-center gap-2 mt-3 md:mt-0">
          <ExportButton action={exportTransaksiCSV} label="Export Transaksi" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter mb-gutter">
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
              {i === 0 && (
                <div className="absolute bottom-0 right-0 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 translate-y-4">
                  <DollarSign size={120} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Chart + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-gutter">
        {/* Chart */}
        <div className="lg:col-span-8 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-headline-sm text-headline-sm text-on-surface">Omzet Harian (7 Hari Terakhir)</h3>
            <button className="flex items-center gap-2 text-primary font-label-md px-3 py-1 border border-primary-fixed rounded-full hover:bg-primary-fixed transition-colors">
              <Download size={14} />
              Export PDF
            </button>
          </div>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-on-surface-variant">
              <div className="text-center">
                <DollarSign size={48} className="mx-auto mb-2 text-outline-variant" />
                <p className="font-body-md">Belum ada data transaksi</p>
              </div>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dbc2b0" strokeOpacity={0.3} />
                  <XAxis dataKey="hari" tick={{ fontFamily: 'Inter', fontSize: 12 }} />
                  <YAxis tick={{ fontFamily: 'Inter', fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => formatRupiah(value)}
                    contentStyle={{
                      background: 'rgba(255,255,255,0.95)',
                      border: '1px solid #dbc2b0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Line type="monotone" dataKey="omzet" stroke="#8d4b00" strokeWidth={3} name="Omzet" dot={{ fill: '#8d4b00', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top Products */}
        <div className="lg:col-span-4 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant">
          <h3 className="font-headline-sm text-headline-sm text-on-surface mb-6">Produk Terlaris</h3>
          {ranking.length === 0 ? (
            <div className="text-center py-12 text-on-surface-variant font-body-md">Belum ada data penjualan</div>
          ) : (
            <div className="flex flex-col gap-4">
              {ranking.slice(0, 3).map((item, i) => {
                const rankColors = ['bg-primary-fixed text-primary', 'bg-secondary-fixed text-secondary', 'bg-tertiary-fixed text-tertiary'];
                const estimatedRevenue = item.qty_total * (i === 0 ? 15000 : i === 1 ? 12000 : 10000);
                const revenueStr = formatRupiah(estimatedRevenue);
                return (
                  <div key={item.id_produk} className="flex items-center gap-4 p-3 bg-surface rounded-lg border border-outline-variant/30">
                    <div className={`w-12 h-12 rounded-lg ${rankColors[i]} flex items-center justify-center font-bold`}>
                      #{i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-label-md text-on-surface truncate">{item.nama_produk}</p>
                      <p className="font-caption text-caption text-on-surface-variant">{item.qty_total} Pcs Terjual</p>
                    </div>
                    <span className="font-bold text-primary font-headline-sm">{revenueStr}</span>
                  </div>
                );
              })}
            </div>
          )}
          <Link
            href="/master-data/produk"
            className="w-full mt-6 py-2 text-primary font-label-md border border-primary-fixed-dim rounded-lg hover:bg-primary-fixed-dim transition-colors flex items-center justify-center gap-1"
          >
            Lihat Semua Produk <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Chat Log Analytics */}
      {chatAnalytics && (
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant mb-gutter">
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
          {chatAnalytics.topQuestions?.length > 0 && (
            <div>
              <h4 className="font-label-md text-label-md text-on-surface mb-3">Pertanyaan Tersering</h4>
              <div className="space-y-2">
                {chatAnalytics.topQuestions.map((q: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-surface-container-low rounded-lg px-4 py-2">
                    <span className="font-body-md text-body-md text-on-surface truncate mr-4">{q.user_message}</span>
                    <span className="font-label-md text-label-md text-primary shrink-0">{q.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant mb-4">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">Transaksi Terakhir</h3>
          <Link href="/master-data/transaksi-offline" className="text-primary font-label-md hover:underline">
            Semua Transaksi
          </Link>
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
                {transaksi.slice(0, 10).map((tx: any) => {
                  const date = tx.waktu_simpan ? new Date(tx.waktu_simpan) : null;
                  const now = new Date();
                  const isToday = date && date.toDateString() === now.toDateString();
                  const timeStr = isToday
                    ? 'Hari ini, ' + date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                    : date
                      ? date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }) + ', ' + date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                      : '-';
                  return (
                    <tr key={tx.id_transaksi} className="hover:bg-surface-cream transition-colors">
                      <td className="px-6 py-4 font-mono text-mono">#{tx.id_transaksi}</td>
                      <td className="px-6 py-4 text-on-surface-variant font-body-md">{timeStr}</td>
                      <td className="px-6 py-4 font-medium font-body-md">{tx.nama_pelanggan || '-'}</td>
                      <td className="px-6 py-4 font-bold text-primary font-body-md">{formatRupiah(tx.total_bayar)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full font-label-md text-[10px] ${
                          tx.status_pembayaran === 'Lunas' ? 'bg-green-100 text-green-700' :
                          tx.status_pembayaran === 'Piutang' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {tx.status_pembayaran}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
