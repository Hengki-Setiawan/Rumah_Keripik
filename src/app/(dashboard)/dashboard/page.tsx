'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bot,
  Cpu,
  Home,
  MessageSquare,
  Minus,
  Package,
  ShieldCheck,
  TrendingUp,
  Users,
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
    const interval = setInterval(() => fetchStatus().catch(() => {}), 15000);
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

function MetricPill({
  label,
  value,
  change,
  icon,
  loading,
}: {
  label: string;
  value: string;
  change?: number | null;
  icon: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="rounded-[1.6rem] border border-[#eadfce] bg-[rgba(255,251,245,0.78)] p-4 shadow-[0_16px_36px_rgba(47,36,28,0.05)] backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f4ead9] text-[#6b4423]">
          {icon}
        </div>
        {change !== undefined && change !== null && (
          <div
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              change > 0
                ? 'bg-emerald-50 text-emerald-700'
                : change < 0
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-[#f3ebdc] text-[#756252]'
            }`}
          >
            {change > 0 ? <ArrowUpRight size={12} /> : change < 0 ? <ArrowDownRight size={12} /> : <Minus size={12} />}
            {change > 0 ? '+' : ''}
            {change.toFixed(1)}%
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-7 w-2/3 rounded bg-[#efe4d3]" />
          <div className="h-3 w-1/2 rounded bg-[#f3ebdc]" />
        </div>
      ) : (
        <>
          <p className="text-2xl font-semibold tracking-[-0.04em] text-[#2f241c]">{value}</p>
          <p className="mt-1 text-sm text-[#776454]">{label}</p>
        </>
      )}
    </div>
  );
}

const modules = [
  {
    href: '/master-data/produk',
    title: 'Manajemen Produk',
    description: 'Kelola stok, harga, dan katalog tanpa buka terlalu banyak halaman.',
    icon: Package,
  },
  {
    href: '/master-data/pelanggan',
    title: 'Pelanggan & Mitra',
    description: 'Pantau pelanggan chatbot, reseller, dan relasi warung.',
    icon: Users,
  },
  {
    href: '/transaksi',
    title: 'Transaksi',
    description: 'Verifikasi pembayaran, order masuk, dan alur pengiriman.',
    icon: TrendingUp,
  },
  {
    href: '/livechat',
    title: 'Hub Komunikasi',
    description: 'Buka live chat dan tindak lanjuti percakapan pelanggan lebih cepat.',
    icon: MessageSquare,
  },
  {
    href: '/bot-config',
    title: 'Knowledge Base & AI',
    description: 'Atur basis pengetahuan, respon bot, dan eksperimen AI.',
    icon: Bot,
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, loading } = useKPI();
  const worker = useWorkerStatus();
  const activeTab = searchParams.get('tab') === 'analytics' ? 'analytics' : 'overview';

  const pendapatanChange = pctChange(data?.pendapatan_hari_ini ?? 0, data?.pendapatan_kemarin ?? 0);
  const orderChange = pctChange(data?.order_hari_ini ?? 0, data?.order_kemarin ?? 0);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2.2rem] border border-[#eadfce] bg-[radial-gradient(circle_at_top,rgba(214,162,74,0.18),transparent_34%),linear-gradient(135deg,rgba(255,251,245,0.95)_0%,rgba(246,239,228,0.90)_100%)] p-6 shadow-[0_24px_70px_rgba(47,36,28,0.08)] md:p-8">
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-[#fff0cb]/60 blur-3xl" />
        <div className="relative grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-[#eadfce] bg-[#fffaf3]/88 px-4 py-2 text-xs font-medium text-[#6f5d4f]">
              <span className="h-2 w-2 rounded-full bg-[#7a963a]" />
              Ringkasan operasional hari ini
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.06em] text-[#2f241c] md:text-5xl">
              Dashboard yang lebih ringan,
              <br className="hidden md:block" /> tapi tetap tajam untuk operasional UMKM.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#6f5d4f] md:text-base">
              Fokus ke hal yang paling penting: pendapatan, order, chat pelanggan, dan status worker AI. Tampilan dibuat lebih frameless supaya terasa seperti workspace modern.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => router.replace('/dashboard')}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${
                  activeTab === 'overview'
                    ? 'bg-[#111111] text-white shadow-[0_14px_34px_rgba(17,17,17,0.14)]'
                    : 'border border-[#eadfce] bg-[#fffaf3] text-[#2f241c]'
                }`}
              >
                <Home size={16} />
                Beranda
              </button>
              <button
                onClick={() => router.replace('/dashboard?tab=analytics')}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${
                  activeTab === 'analytics'
                    ? 'bg-[#111111] text-white shadow-[0_14px_34px_rgba(17,17,17,0.14)]'
                    : 'border border-[#eadfce] bg-[#fffaf3] text-[#2f241c]'
                }`}
              >
                <BarChart3 size={16} />
                Analitik
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <MetricPill
              label="Pendapatan Hari Ini"
              value={data ? formatRupiah(data.pendapatan_hari_ini) : '-'}
              change={pendapatanChange}
              icon={<TrendingUp size={20} />}
              loading={loading}
            />
            <MetricPill
              label="Order Hari Ini"
              value={data ? String(data.order_hari_ini) : '-'}
              change={orderChange}
              icon={<Package size={20} />}
              loading={loading}
            />
          </div>
        </div>
      </section>

      {activeTab === 'analytics' ? (
        <AnalyticsHub />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricPill
              label="Chat Bot Hari Ini"
              value={data ? String(data.chat_bot_hari_ini) : '-'}
              icon={<MessageSquare size={20} />}
              loading={loading}
            />
            <MetricPill
              label="Menunggu Verifikasi"
              value={data ? String(data.pending_verifikasi) : '-'}
              icon={<Bell size={20} />}
              loading={loading}
            />
            <MetricPill
              label="Pendapatan Hari Ini"
              value={data ? formatRupiah(data.pendapatan_hari_ini) : '-'}
              change={pendapatanChange}
              icon={<TrendingUp size={20} />}
              loading={loading}
            />
            <MetricPill
              label="Order Hari Ini"
              value={data ? String(data.order_hari_ini) : '-'}
              change={orderChange}
              icon={<Package size={20} />}
              loading={loading}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[2rem] border border-[#eadfce] bg-[rgba(255,251,245,0.78)] p-6 shadow-[0_18px_44px_rgba(47,36,28,0.05)] backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a08973]">Local AI Worker</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#2f241c]">
                    {worker?.online ? 'Online dan siap proses job' : 'Sedang offline sementara'}
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-[#776454]">
                    {worker?.online
                      ? 'Komputer lokal sedang menangani job berat. Sistem cloud tetap menyimpan antrian agar aman.'
                      : 'Antrian tetap aman tersimpan. Begitu worker aktif lagi, proses berat akan lanjut otomatis.'}
                  </p>
                </div>
                <div className={`grid h-12 w-12 place-items-center rounded-2xl ${worker?.online ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  <Cpu size={22} />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  { label: 'Pending', value: worker?.counts.pending ?? '-' },
                  { label: 'Proses', value: worker?.counts.processing ?? '-' },
                  { label: 'Gagal', value: worker?.counts.failed ?? '-' },
                ].map((item) => (
                  <div key={item.label} className="rounded-[1.4rem] bg-[#fffaf3] p-4 text-center">
                    <p className="text-2xl font-semibold tracking-[-0.04em] text-[#2f241c]">{item.value}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#9b8772]">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#eadfce] bg-[rgba(255,251,245,0.78)] p-6 shadow-[0_18px_44px_rgba(47,36,28,0.05)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a08973]">Aksi cepat</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#2f241c]">Langsung ke pekerjaan penting</h2>
              <div className="mt-6 grid gap-3">
                {[
                  { href: '/transaksi?tab=verifikasi', icon: <ShieldCheck size={16} />, label: 'Cek verifikasi pembayaran' },
                  { href: '/livechat', icon: <MessageSquare size={16} />, label: 'Buka live chat' },
                  { href: '/master-data/produk', icon: <Package size={16} />, label: 'Update stok produk' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-[1.4rem] border border-[#eadfce] bg-[#fffaf3] px-4 py-4 text-sm font-medium text-[#2f241c] transition hover:-translate-y-0.5 hover:border-[#d8c1a6] hover:bg-white"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f4ead9] text-[#6b4423]">
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section>
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a08973]">Modul sistem</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#2f241c]">Workspace operasional</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {modules.map((module) => {
                const Icon = module.icon;
                return (
                  <Link
                    key={module.href}
                    href={module.href}
                    className="group rounded-[1.8rem] border border-[#eadfce] bg-[rgba(255,251,245,0.78)] p-6 shadow-[0_18px_44px_rgba(47,36,28,0.05)] backdrop-blur transition hover:-translate-y-1 hover:border-[#d8c1a6] hover:bg-white"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f4ead9] text-[#6b4423]">
                        <Icon size={20} />
                      </div>
                      <span className="text-sm text-[#9b8772] transition group-hover:text-[#2f241c]">Buka</span>
                    </div>
                    <h3 className="text-lg font-semibold tracking-[-0.03em] text-[#2f241c]">{module.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-[#776454]">{module.description}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
