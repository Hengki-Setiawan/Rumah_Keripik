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
  ChevronRight,
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

interface PublicOrderOpsData {
  summary: {
    orders30d: number;
    chatOrders30d: number;
  };
  recentChatOrders: Array<{
    id: string;
    code: string | null;
    recipient: string | null;
    total: number;
    paymentStatus: string;
    orderStatus: string;
    createdAt: string;
  }>;
}

function useKPI() {
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchKPI() {
      try {
        const res = await fetch('/api/analytics/kpi');
        if (res.ok) setData(await res.json());
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

function usePublicOrderOps() {
  const [data, setData] = useState<PublicOrderOpsData | null>(null);

  useEffect(() => {
    async function fetchData() {
      const res = await fetch('/api/analytics/public-order-operations');
      if (res.ok) setData(await res.json());
    }

    fetchData().catch(() => {});
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

function KPIChip({
  label,
  value,
  change,
  icon,
  urgent = false,
  loading,
}: {
  label: string;
  value: string;
  change?: number | null;
  icon: React.ReactNode;
  urgent?: boolean;
  loading?: boolean;
}) {
  return (
    <div className={`rounded-[1.4rem] border p-4 shadow-[0_14px_34px_rgba(47,36,28,0.04)] backdrop-blur ${
      urgent
        ? 'border-[#f1cdb7] bg-[rgba(255,243,234,0.92)]'
        : 'border-[#f0dfca] bg-[rgba(255,250,244,0.88)]'
    }`}>
      <div className="mb-3 flex items-center justify-between">
        <div className={`grid h-10 w-10 place-items-center rounded-2xl ${
          urgent ? 'bg-[#fff1db] text-[#c55a2b]' : 'bg-[#fde8d9] text-[#c55a2b]'
        }`}>
          {icon}
        </div>
        {change !== undefined && change !== null && (
          <div
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              change > 0
                ? 'bg-emerald-50 text-emerald-700'
                : change < 0
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-[#f7eddf] text-[#756252]'
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
          <div className="h-6 w-1/2 rounded bg-[#efe4d3]" />
          <div className="h-3 w-2/3 rounded bg-[#f7eddf]" />
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
    href: '/hub-komunikasi',
    title: 'Hub Komunikasi',
    description: 'Pusat web chat AI, takeover admin, customer context, dan order timeline.',
    icon: MessageSquare,
  },
  {
    href: '/ai-workspace',
    title: 'Knowledge Base & AI',
    description: 'Kelola knowledge base, router AI, observability, dan audit kemampuan aktif.',
    icon: Bot,
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, loading } = useKPI();
  const worker = useWorkerStatus();
  const publicOrderOps = usePublicOrderOps();
  const activeTab = searchParams.get('tab') === 'analytics' ? 'analytics' : 'overview';

  const pendapatanChange = pctChange(data?.pendapatan_hari_ini ?? 0, data?.pendapatan_kemarin ?? 0);
  const orderChange = pctChange(data?.order_hari_ini ?? 0, data?.order_kemarin ?? 0);

  const pendingQueue = [
    {
      title: 'Verifikasi pembayaran',
      value: data?.pending_verifikasi ?? 0,
      tone: (data?.pending_verifikasi ?? 0) > 0 ? 'urgent' : 'normal',
      href: '/transaksi?tab=verifikasi',
      description: (data?.pending_verifikasi ?? 0) > 0 ? 'Perlu dicek sekarang' : 'Tidak ada yang menunggu',
    },
    {
      title: 'Job worker pending',
      value: worker?.counts.pending ?? 0,
      tone: (worker?.counts.pending ?? 0) > 0 ? 'normal' : 'calm',
      href: '/dashboard',
      description: 'Antrian proses lokal',
    },
    {
      title: 'Aktivitas chat hari ini',
      value: data?.chat_bot_hari_ini ?? 0,
      tone: 'calm',
      href: '/hub-komunikasi',
      description: 'Pantau percakapan pelanggan',
    },
  ];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2.1rem] border border-[#f0dfca] bg-[radial-gradient(circle_at_top,rgba(240,180,41,0.20),transparent_32%),linear-gradient(135deg,rgba(255,250,244,0.96)_0%,rgba(248,240,229,0.92)_100%)] p-6 shadow-[0_24px_70px_rgba(47,36,28,0.08)] md:p-8">
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-[#ffe9bf]/65 blur-3xl" />
        <div className="relative grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-[#f0dfca] bg-[#fffaf3]/92 px-4 py-2 text-xs font-medium text-[#6f5d4f]">
              <span className="h-2 w-2 rounded-full bg-[#7f9f3e]" />
              Ringkasan operasional hari ini
            </div>
            <h1 className="max-w-3xl text-[2rem] font-semibold leading-[0.98] tracking-[-0.06em] text-[#2f241c] sm:text-[2.4rem] md:text-5xl">
              Workspace operasional yang lebih ringan,
              <br className="hidden md:block" /> lebih cepat dibaca, dan satu bahasa dengan AI chat.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#6f5d4f] md:text-base">
              Pendapatan, order, live chat, dan worker AI ditampilkan dengan hirarki yang lebih tenang supaya keputusan harian bisa diambil lebih cepat.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => router.replace('/dashboard')}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${
                  activeTab === 'overview'
                    ? 'bg-[#c55a2b] text-white shadow-[0_14px_34px_rgba(197,90,43,0.16)]'
                    : 'border border-[#f0dfca] bg-[#fffaf3] text-[#2f241c]'
                }`}
              >
                <Home size={16} />
                Beranda
              </button>
              <button
                onClick={() => router.replace('/dashboard?tab=analytics')}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${
                  activeTab === 'analytics'
                    ? 'bg-[#c55a2b] text-white shadow-[0_14px_34px_rgba(197,90,43,0.16)]'
                    : 'border border-[#f0dfca] bg-[#fffaf3] text-[#2f241c]'
                }`}
              >
                <BarChart3 size={16} />
                Analitik
              </button>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[1.8rem] border border-[#f0dfca] bg-[rgba(255,250,244,0.88)] p-5 shadow-[0_18px_44px_rgba(47,36,28,0.05)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a08973]">Hero KPI</p>
              {loading ? (
                <div className="mt-4 space-y-2 animate-pulse">
                  <div className="h-10 w-2/3 rounded bg-[#efe4d3]" />
                  <div className="h-4 w-1/2 rounded bg-[#f7eddf]" />
                </div>
              ) : (
                <>
                  <p className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-[#2f241c]">
                    {formatRupiah(data?.pendapatan_hari_ini ?? 0)}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-sm text-[#6f5d4f]">
                    <TrendingUp size={16} className="text-[#c55a2b]" />
                    Pendapatan Hari Ini
                    {pendapatanChange !== null && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        pendapatanChange >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
                      }`}>
                        {pendapatanChange >= 0 ? '+' : ''}{pendapatanChange.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <KPIChip
                label="Order Hari Ini"
                value={data ? String(data.order_hari_ini) : '-'}
                change={orderChange}
                icon={<Package size={20} />}
                loading={loading}
              />
              <KPIChip
                label="Chat Aktif Hari Ini"
                value={data ? String(data.chat_bot_hari_ini) : '-'}
                icon={<MessageSquare size={20} />}
                loading={loading}
              />
            </div>

            <KPIChip
              label="Perlu Verifikasi"
              value={data ? String(data.pending_verifikasi) : '-'}
              icon={<Bell size={20} />}
              urgent
              loading={loading}
            />
          </div>
        </div>
      </section>

      {activeTab === 'analytics' ? (
        <AnalyticsHub />
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-[1.06fr_0.94fr]">
            <div className="rounded-[1.9rem] border border-[#f0dfca] bg-[rgba(255,250,244,0.88)] p-6 shadow-[0_18px_44px_rgba(47,36,28,0.05)] backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a08973]">AI operations snapshot</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#2f241c]">
                    {worker?.online ? 'Worker online dan siap proses job' : 'Worker sedang offline sementara'}
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-[#776454]">
                    {worker?.online
                      ? 'Komputer lokal sedang menangani job berat. Sistem cloud tetap menyimpan antrian agar aman.'
                      : 'Antrian tetap aman tersimpan. Begitu worker aktif lagi, proses berat akan lanjut otomatis.'}
                  </p>
                </div>
                <div className={`grid h-12 w-12 place-items-center rounded-2xl ${worker?.online ? 'bg-[#eef6dd] text-[#6a852d]' : 'bg-[#fff1db] text-[#c55a2b]'}`}>
                  <Cpu size={22} />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { label: 'Pending', value: worker?.counts.pending ?? '-' },
                  { label: 'Proses', value: worker?.counts.processing ?? '-' },
                  { label: 'Gagal', value: worker?.counts.failed ?? '-' },
                ].map((item) => (
                  <div key={item.label} className="rounded-[1.3rem] bg-[#fbf2e7] p-4 text-center">
                    <p className="text-2xl font-semibold tracking-[-0.04em] text-[#2f241c]">{item.value}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#9b8772]">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.9rem] border border-[#f0dfca] bg-[rgba(255,250,244,0.88)] p-6 shadow-[0_18px_44px_rgba(47,36,28,0.05)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a08973]">Pending action queue</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#2f241c]">Apa yang perlu ditangani sekarang</h2>
              <div className="mt-6 space-y-3">
                {pendingQueue.map((item) => (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="flex items-center justify-between gap-4 rounded-[1.35rem] border border-[#f0dfca] bg-[#fffaf3] px-4 py-4 transition hover:-translate-y-0.5 hover:border-[#dfc5a8] hover:bg-white"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#2f241c]">{item.title}</p>
                      <p className="mt-1 text-sm text-[#776454]">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        item.tone === 'urgent'
                          ? 'bg-[#fff1db] text-[#c55a2b]'
                          : item.tone === 'calm'
                            ? 'bg-[#eef6dd] text-[#5d7b20]'
                            : 'bg-[#f7eddf] text-[#756252]'
                      }`}>
                        {item.value}
                      </span>
                      <ChevronRight size={16} className="text-[#9b8772]" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[1.9rem] border border-[#f0dfca] bg-[rgba(255,250,244,0.88)] p-6 shadow-[0_18px_44px_rgba(47,36,28,0.05)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a08973]">Key shortcuts</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#2f241c]">Langsung ke pekerjaan penting</h2>
              <div className="mt-6 grid gap-3">
                {[
                  { href: '/transaksi?tab=verifikasi', icon: <ShieldCheck size={16} />, label: 'Cek verifikasi pembayaran' },
                  { href: '/hub-komunikasi', icon: <MessageSquare size={16} />, label: 'Buka hub komunikasi' },
                  { href: '/master-data/produk', icon: <Package size={16} />, label: 'Update stok produk' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-[1.35rem] border border-[#f0dfca] bg-[#fffaf3] px-4 py-4 text-sm font-medium text-[#2f241c] transition hover:-translate-y-0.5 hover:border-[#dfc5a8] hover:bg-white"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#fde8d9] text-[#c55a2b]">
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a08973]">Modul sistem</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#2f241c]">Workspace operasional</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                {modules.map((module) => {
                  const Icon = module.icon;
                  return (
                    <Link
                      key={module.href}
                      href={module.href}
                      className="group rounded-[1.7rem] border border-[#f0dfca] bg-[rgba(255,250,244,0.88)] p-6 shadow-[0_18px_44px_rgba(47,36,28,0.05)] backdrop-blur transition hover:-translate-y-1 hover:border-[#dfc5a8] hover:bg-white"
                    >
                      <div className="mb-4 flex items-start justify-between">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fde8d9] text-[#c55a2b]">
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
            </div>
          </section>

          <section className="rounded-[1.9rem] border border-[#f0dfca] bg-[rgba(255,250,244,0.88)] p-6 shadow-[0_18px_44px_rgba(47,36,28,0.05)] backdrop-blur">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a08973]">Channel /pesan</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#2f241c]">Order yang masuk dari AI chat</h2>
                <p className="mt-2 text-sm text-[#776454]">
                  Memastikan channel web chat benar-benar terbaca sebagai sumber order yang terpisah.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#fff1db] px-4 py-2 text-sm font-semibold text-[#c55a2b]">
                <Bot size={16} />
                {publicOrderOps?.summary.chatOrders30d ?? 0} order chat / 30 hari
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {(publicOrderOps?.recentChatOrders || []).map((order) => (
                <Link
                  key={order.id}
                  href="/transaksi"
                  className="rounded-[1.35rem] border border-[#f0dfca] bg-[#fffaf3] p-4 transition hover:-translate-y-0.5 hover:border-[#dfc5a8] hover:bg-white"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a08973]">
                    {order.code || order.id}
                  </p>
                  <p className="mt-2 truncate text-sm font-semibold text-[#2f241c]">{order.recipient || 'Customer web'}</p>
                  <p className="mt-1 text-sm text-[#776454]">{formatRupiah(order.total)}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full bg-[#eef6dd] px-2 py-0.5 font-semibold text-[#5d7b20]">
                      {order.orderStatus.replace(/_/g, ' ')}
                    </span>
                    <span className="rounded-full bg-[#fde8d9] px-2 py-0.5 font-semibold text-[#c55a2b]">
                      {order.paymentStatus.replace(/_/g, ' ')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
