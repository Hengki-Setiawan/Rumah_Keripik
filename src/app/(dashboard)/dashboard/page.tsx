'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Home,
  BarChart3,
  Package,
  MessageSquare,
  TrendingUp,
  Bot,
  Users,
  ShieldCheck,
  Bell,
  Cpu,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { AnalyticsHub } from '@/components/dashboard/AnalyticsHub';

interface KPIData {
  pendapatan_hari_ini: number;
  pendapatan_kemarin: number;
  order_hari_ini: number;
  order_kemarin: number;
  chat_bot_hari_ini: number;
  pending_verifikasi: number;
}

interface WorkerStatus {
  online: boolean;
  counts: { pending: number; processing: number; failed: number };
  workers: { worker_id: string; worker_name: string | null; seconds_ago: number | null; online: boolean }[];
}

function useKPI() {
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchKPI() {
      try {
        const res = await fetch('/api/analytics/kpi');
        if (res.ok) {
          setData(await res.json());
        }
      } finally {
        setLoading(false);
      }
    }
    fetchKPI().catch(console.error);
  }, []);

  return { data, loading };
}

function useWorkerStatus() {
  const [data, setData] = useState<WorkerStatus | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      const res = await fetch('/api/worker/status');
      if (res.ok) setData(await res.json());
    }

    fetchStatus().catch(() => {});
    const interval = setInterval(() => fetchStatus().catch(() => {}), 15_000);
    return () => clearInterval(interval);
  }, []);

  return data;
}

function formatRupiah(n: number) {
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}rb`;
  return `Rp ${n}`;
}

function pctChange(current: number, prev: number): number | null {
  if (!prev) return null;
  return ((current - prev) / prev) * 100;
}

interface KPICardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  change?: number | null;
  urgent?: boolean;
  href?: string;
  loading?: boolean;
}

function KPICard({ title, value, icon, change, urgent, href, loading }: KPICardProps) {
  const content = (
    <div
      className={`bg-surface-container-lowest border rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-300 group ${
        urgent ? 'border-orange-300 bg-orange-50 hover:border-orange-400' : 'border-neutral-200 hover:border-primary/30'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${urgent ? 'bg-orange-100 text-orange-600' : 'bg-primary/10 text-primary'}`}>
          {icon}
        </div>
        {href && <ArrowUpRight size={16} className="text-on-surface-variant/40 group-hover:text-primary group-hover:opacity-100 transition-all opacity-0" />}
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-7 bg-surface-container rounded w-2/3" />
          <div className="h-3 bg-surface-container rounded w-1/2" />
        </div>
      ) : (
        <>
          <p className={`text-2xl font-bold mb-0.5 ${urgent ? 'text-orange-700' : 'text-on-surface'}`}>{value}</p>
          <p className="text-xs text-on-surface-variant font-medium">{title}</p>
          {change !== undefined && change !== null && (
            <div className={`flex items-center gap-0.5 mt-1.5 text-[11px] font-semibold ${
              change > 0 ? 'text-green-600' : change < 0 ? 'text-red-500' : 'text-on-surface-variant'
            }`}>
              {change > 0 ? <ArrowUpRight size={12} /> : change < 0 ? <ArrowDownRight size={12} /> : <Minus size={12} />}
              {change > 0 ? '+' : ''}{change.toFixed(1)}% vs kemarin
            </div>
          )}
        </>
      )}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

const modules = [
  {
    href: '/master-data/produk',
    title: 'Manajemen Produk',
    description: 'CRUD produk, manajemen stok, dan pengaturan harga.',
    icon: Package,
    color: 'bg-blue-100 text-blue-700',
  },
  {
    href: '/master-data/pelanggan',
    title: 'Pelanggan & Mitra',
    description: 'Kelola pelanggan chatbot, warung grosir, dan peta distribusi.',
    icon: Users,
    color: 'bg-green-100 text-green-700',
  },
  {
    href: '/transaksi',
    title: 'Transaksi & Pengiriman',
    description: 'Kelola penjualan, piutang, verifikasi, dan zona pengiriman.',
    icon: TrendingUp,
    color: 'bg-orange-100 text-orange-700',
  },
  {
    href: '/livechat',
    title: 'Hub Komunikasi',
    description: 'Pantau live chat dan tindak lanjuti percakapan pelanggan.',
    icon: MessageSquare,
    color: 'bg-pink-100 text-pink-700',
  },
  {
    href: '/bot-config',
    title: 'Knowledge Base & AI',
    description: 'Kelola basis pengetahuan, auto reply, log, dan analitik bot.',
    icon: Bot,
    color: 'bg-indigo-100 text-indigo-700',
  },
];

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const { data, loading } = useKPI();
  const worker = useWorkerStatus();
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics'>('overview');

  useEffect(() => {
    setActiveTab(searchParams.get('tab') === 'analytics' ? 'analytics' : 'overview');
  }, [searchParams]);

  const pendapatanChange = pctChange(data?.pendapatan_hari_ini ?? 0, data?.pendapatan_kemarin ?? 0);
  const orderChange = pctChange(data?.order_hari_ini ?? 0, data?.order_kemarin ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-headline-lg text-headline-lg text-on-surface">Dashboard Rumah Kripik</h2>
        <p className="text-on-surface-variant mt-1 font-body-md">
          Halaman utama sekarang merangkum beranda dan analitik supaya alur kerja lebih singkat.
        </p>
      </div>

      <div className="flex gap-1 bg-surface-container-lowest border border-neutral-200 rounded-xl p-1 w-full md:w-fit">
        {[
          { key: 'overview' as const, label: 'Beranda', icon: Home },
          { key: 'analytics' as const, label: 'Analitik', icon: BarChart3 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-label-md text-label-md transition-all ${
                isActive ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'analytics' ? (
        <AnalyticsHub />
      ) : (
        <>
          <div>
            <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wide mb-3">Ringkasan Hari Ini</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Pendapatan Hari Ini"
                value={data ? formatRupiah(data.pendapatan_hari_ini) : '-'}
                icon={<TrendingUp size={20} />}
                change={pendapatanChange}
                href="/dashboard?tab=analytics"
                loading={loading}
              />
              <KPICard
                title="Order Hari Ini"
                value={data ? String(data.order_hari_ini) : '-'}
                icon={<Package size={20} />}
                change={orderChange}
                href="/transaksi"
                loading={loading}
              />
              <KPICard
                title="Chat Bot Hari Ini"
                value={data ? String(data.chat_bot_hari_ini) : '-'}
                icon={<MessageSquare size={20} />}
                href="/livechat"
                loading={loading}
              />
              <KPICard
                title="Menunggu Verifikasi"
                value={data ? String(data.pending_verifikasi) : '-'}
                icon={<Bell size={20} />}
                urgent={(data?.pending_verifikasi ?? 0) > 0}
                href="/transaksi?tab=verifikasi"
                loading={loading}
              />
            </div>
          </div>

          <div className={`rounded-xl border p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
            worker?.online ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-lg ${worker?.online ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                <Cpu size={20} />
              </div>
              <div>
                <p className="font-bold text-on-surface">Local AI Worker</p>
                <p className="text-sm text-on-surface-variant mt-0.5">
                  {worker?.online
                    ? 'Online. Job berat diproses dari komputer lokal.'
                    : 'Offline. Job tetap aman tersimpan di Turso dan akan diproses saat worker hidup.'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-on-surface">{worker?.counts.pending ?? '-'}</p>
                <p className="text-[11px] text-on-surface-variant">Pending</p>
              </div>
              <div>
                <p className="text-lg font-bold text-on-surface">{worker?.counts.processing ?? '-'}</p>
                <p className="text-[11px] text-on-surface-variant">Proses</p>
              </div>
              <div>
                <p className="text-lg font-bold text-on-surface">{worker?.counts.failed ?? '-'}</p>
                <p className="text-[11px] text-on-surface-variant">Gagal</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wide mb-3">Modul Sistem</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
              {modules.map((module) => {
                const Icon = module.icon;
                return (
                  <Link
                    key={module.href}
                    href={module.href}
                    className="group bg-surface-container-lowest rounded-xl border border-neutral-200 hover:shadow-lg transition-all duration-300 p-6 hover:border-primary/30"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-lg ${module.color}`}>
                        <Icon size={22} />
                      </div>
                      <span className="font-caption text-caption text-outline group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100">
                        Buka {'->'}
                      </span>
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">{module.title}</h3>
                    <p className="font-body-md text-body-md text-on-surface-variant">{module.description}</p>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/transaksi?tab=verifikasi" className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-neutral-200 rounded-xl text-sm font-medium text-on-surface hover:border-primary/40 hover:shadow-sm transition-all">
              <ShieldCheck size={16} className="text-orange-500" />
              Cek Verifikasi Pembayaran
            </Link>
            <Link href="/livechat" className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-neutral-200 rounded-xl text-sm font-medium text-on-surface hover:border-primary/40 hover:shadow-sm transition-all">
              <MessageSquare size={16} className="text-green-500" />
              Live Chat
            </Link>
            <Link href="/master-data/produk" className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-neutral-200 rounded-xl text-sm font-medium text-on-surface hover:border-primary/40 hover:shadow-sm transition-all">
              <Package size={16} className="text-blue-500" />
              Update Stok Produk
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
