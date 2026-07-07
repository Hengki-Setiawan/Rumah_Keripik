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
      className={`bg-surface-container-lowest border rounded-2xl p-5 transition-all duration-200 group ${
        urgent ? 'border-orange-200 bg-orange-50 hover:border-orange-300' : 'border-outline-variant hover:border-outline'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${urgent ? 'bg-orange-100 text-orange-600' : 'bg-surface-container text-on-surface-variant'}`}>
          {icon}
        </div>
        {href && <ArrowUpRight size={16} className="text-on-surface-variant/40 group-hover:text-on-surface group-hover:opacity-100 transition-all opacity-0" />}
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-7 bg-surface-container rounded w-2/3" />
          <div className="h-3 bg-surface-container rounded w-1/2" />
        </div>
      ) : (
        <>
          <p className={`text-2xl font-semibold tracking-[-0.03em] mb-0.5 ${urgent ? 'text-orange-700' : 'text-on-surface'}`}>{value}</p>
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
    color: 'bg-surface-container text-on-surface-variant',
  },
  {
    href: '/master-data/pelanggan',
    title: 'Pelanggan & Mitra',
    description: 'Kelola pelanggan chatbot, warung grosir, dan peta distribusi.',
    icon: Users,
    color: 'bg-surface-container text-on-surface-variant',
  },
  {
    href: '/transaksi',
    title: 'Transaksi & Pengiriman',
    description: 'Kelola penjualan, piutang, verifikasi, dan zona pengiriman.',
    icon: TrendingUp,
    color: 'bg-surface-container text-on-surface-variant',
  },
  {
    href: '/livechat',
    title: 'Hub Komunikasi',
    description: 'Pantau live chat dan tindak lanjuti percakapan pelanggan.',
    icon: MessageSquare,
    color: 'bg-surface-container text-on-surface-variant',
  },
  {
    href: '/bot-config',
    title: 'Knowledge Base & AI',
    description: 'Kelola basis pengetahuan, auto reply, log, dan analitik bot.',
    icon: Bot,
    color: 'bg-surface-container text-on-surface-variant',
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
        <h2 className="text-3xl font-semibold tracking-[-0.04em] text-on-surface">Dashboard</h2>
        <p className="text-on-surface-variant mt-2 text-sm leading-6">
          Ringkasan penjualan, pesanan, dan aktivitas AI Rumah Keripik hari ini.
        </p>
      </div>

      <div className="flex gap-1 bg-surface-container border border-outline-variant rounded-2xl p-1 w-full md:w-fit">
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
                isActive ? 'bg-surface-container-lowest text-on-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)]' : 'text-on-surface-variant hover:text-on-surface'
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
            <h3 className="mb-3 text-sm font-medium text-on-surface-variant">Ringkasan hari ini</h3>
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

          <div className={`rounded-2xl border p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
            worker?.online ? 'bg-surface-container-lowest border-outline-variant' : 'bg-orange-50 border-orange-200'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl ${worker?.online ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                <Cpu size={20} />
              </div>
              <div>
                <p className="font-semibold text-on-surface">Local AI Worker</p>
                <p className="text-sm text-on-surface-variant mt-0.5">
                  {worker?.online
                    ? 'Online. Job berat diproses dari komputer lokal.'
                    : 'Offline. Job tetap aman tersimpan di Turso dan akan diproses saat worker hidup.'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-semibold text-on-surface">{worker?.counts.pending ?? '-'}</p>
                <p className="text-[11px] text-on-surface-variant">Pending</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-on-surface">{worker?.counts.processing ?? '-'}</p>
                <p className="text-[11px] text-on-surface-variant">Proses</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-on-surface">{worker?.counts.failed ?? '-'}</p>
                <p className="text-[11px] text-on-surface-variant">Gagal</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium text-on-surface-variant">Modul sistem</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
              {modules.map((module) => {
                const Icon = module.icon;
                return (
                  <Link
                    key={module.href}
                    href={module.href}
                    className="group bg-surface-container-lowest rounded-2xl border border-outline-variant transition-all duration-200 p-6 hover:border-outline"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-lg ${module.color}`}>
                        <Icon size={20} />
                      </div>
                      <span className="text-xs font-medium text-on-surface-variant transition-colors opacity-0 group-hover:opacity-100">
                        Buka {'->'}
                      </span>
                    </div>
                    <h3 className="mb-2 text-lg font-semibold tracking-[-0.02em] text-on-surface">{module.title}</h3>
                    <p className="text-sm leading-6 text-on-surface-variant">{module.description}</p>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/transaksi?tab=verifikasi" className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm font-medium text-on-surface hover:bg-surface-container transition-all">
              <ShieldCheck size={16} className="text-on-surface-variant" />
              Cek Verifikasi Pembayaran
            </Link>
            <Link href="/livechat" className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm font-medium text-on-surface hover:bg-surface-container transition-all">
              <MessageSquare size={16} className="text-on-surface-variant" />
              Live Chat
            </Link>
            <Link href="/master-data/produk" className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm font-medium text-on-surface hover:bg-surface-container transition-all">
              <Package size={16} className="text-on-surface-variant" />
              Update Stok Produk
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
