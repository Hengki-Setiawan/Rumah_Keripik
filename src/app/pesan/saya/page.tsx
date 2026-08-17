'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, PackageSearch, RefreshCw, ShoppingBag, Trash2, User } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';

type PortalOrder = {
  idTransaksi: string;
  kodePesanan: string | null;
  totalBayar: number;
  statusPembayaran: string;
  paymentStatus: string;
  orderStatus: string;
  paymentMethod: string | null;
  namaPenerima: string | null;
  alamatPenerima: string | null;
  waktuSimpan: string;
  statusToken: string | null;
};

type PortalDraft = {
  cartId: string;
  chatSessionId: string;
  status: string;
  itemCount: number;
  total: number;
  preview: string;
  updatedAt: string;
};

type PortalData = {
  anonymousLabel?: string | null;
  profile: { id: string; nama: string | null; phone: string | null } | null;
  orders: PortalOrder[];
  drafts: PortalDraft[];
};

const AUTO_REFRESH_MS = 30_000;

const ACTIVE_ORDER_STATUSES = ['awaiting_payment', 'awaiting_admin_confirmation', 'payment_instruction_shown', 'processing', 'shipping', 'ready'];

function isActiveOrder(order: PortalOrder): boolean {
  const s = order.orderStatus.toLowerCase();
  if (['completed', 'cancelled', 'cod_rejected'].includes(s)) return false;
  return ACTIVE_ORDER_STATUSES.includes(s) || order.paymentStatus === 'unpaid';
}

function paymentTone(order: PortalOrder): { label: string; className: string } {
  const p = (order.paymentStatus || '').toLowerCase();
  const s = (order.orderStatus || '').toLowerCase();
  if (s === 'cancelled' || p === 'cancelled' || p === 'cod_rejected') return { label: 'Dibatalkan', className: 'bg-red-50 text-red-700' };
  if (['verified', 'settlement', 'capture', 'paid', 'cod_approved'].includes(p)) return { label: 'Lunas', className: 'bg-[#eef6dd] text-[#3d5a13]' };
  if (['proof_uploaded', 'awaiting_admin_verification'].includes(p)) return { label: 'Menunggu verifikasi', className: 'bg-amber-50 text-amber-800' };
  if (s === 'completed') return { label: 'Selesai', className: 'bg-[#eef6dd] text-[#3d5a13]' };
  return { label: 'Menunggu pembayaran', className: 'bg-orange-50 text-[#8b4c31]' };
}

function canDeleteOrder(order: PortalOrder): boolean {
  const s = (order.orderStatus || '').toLowerCase();
  const p = (order.paymentStatus || '').toLowerCase();
  if (['cancelled', 'cod_rejected', 'rejected', 'gateway_failed'].includes(s)) return false;
  if (['cancelled', 'cod_rejected', 'rejected', 'gateway_failed'].includes(p)) return false;
  if (order.statusPembayaran === 'Lunas') return false;
  if (['processing', 'shipping', 'completed'].includes(s)) return false;
  if (['verified', 'settlement', 'capture', 'paid', 'cod_approved'].includes(p)) return false;
  return true;
}

export default function PesananSayaPage() {
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const hasOrders = (data?.orders.length || 0) > 0;
  const hasDrafts = (data?.drafts.length || 0) > 0;

  const loadPortal = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
      setError('');
    }
    try {
      const response = await fetch('/api/public/me', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Pesanan saya belum bisa dimuat.');
      setData(result);
    } catch (err) {
      if (!options?.silent) setError(err instanceof Error ? err.message : 'Pesanan saya belum bisa dimuat.');
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPortal().catch(() => undefined);
    }, 0);
    return () => clearTimeout(timer);
  }, [loadPortal]);

  // Auto-refresh ringan untuk update status pembayaran tanpa reload manual.
  useEffect(() => {
    if (!hasOrders) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') loadPortal({ silent: true }).catch(() => undefined);
    }, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [hasOrders, loadPortal]);

  const activeOrders = useMemo(() => (data?.orders || []).filter(isActiveOrder), [data]);
  const historyOrders = useMemo(() => (data?.orders || []).filter((order) => !isActiveOrder(order)), [data]);

  async function handleDeleteOrder(order: PortalOrder) {
    const kode = order.kodePesanan || order.idTransaksi;
    setDeleteError('');
    setDeletingId(kode);
    try {
      const response = await fetch(`/api/public/orders/${encodeURIComponent(kode)}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Pesanan gagal dihapus.');
      await loadPortal({ silent: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Pesanan gagal dihapus.');
    } finally {
      setDeletingId(null);
    }
  }

  const latestOrder = useMemo(() => data?.orders[0] || null, [data]);
  const kpi = useMemo(() => {
    const orders = data?.orders || [];
    const awaitingPayment = orders.filter((order) => paymentTone(order).label === 'Menunggu pembayaran').length;
    const totalSpent = orders.reduce((sum, order) => sum + order.totalBayar, 0);
    return { count: orders.length, awaitingPayment, totalSpent };
  }, [data]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(240,180,41,0.16),transparent_25%),radial-gradient(circle_at_82%_18%,rgba(127,159,62,0.10),transparent_20%),linear-gradient(180deg,#faf6ef_0%,#fffaf4_100%)] px-5 py-8 text-[#2f241c]">
      <section className="mx-auto max-w-6xl rounded-[2rem] border border-[#f0dfca] bg-[rgba(255,250,244,0.92)] p-6 shadow-[0_18px_46px_rgba(47,36,28,0.07)] backdrop-blur-xl md:p-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-[#9a8672]">Pesanan saya</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] md:text-5xl">Status pesananmu ada di sini.</h1>
            <p className="mt-3 max-w-2xl text-[#6f5d4f]">
              {data?.profile?.nama
                ? `Halo ${data.profile.nama}! Pesanan yang kamu buat lewat chat muncul otomatis di halaman ini. Tidak perlu login lagi.`
                : 'Pesanan yang kamu buat lewat chat muncul otomatis di halaman ini. Tidak perlu login lagi.'}
            </p>
          </div>
          <Link href="/pesan" className="inline-flex items-center gap-2 rounded-full bg-[#c55a2b] px-5 py-3 font-medium text-white shadow-[0_14px_30px_rgba(197,90,43,0.16)] transition hover:bg-[#ae4d23]">
            Buka chat pesan <ArrowRight size={16} />
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {hasOrders && (
              <p className="text-sm text-[#6f5d4f]">
                {kpi.count} pesanan · {kpi.awaitingPayment > 0 ? <span className="font-semibold text-[#c55a2b]">{kpi.awaitingPayment} menunggu pembayaran</span> : <span className="text-[#3d5a13]">semua lunas</span>}
              </p>
            )}
            {data?.profile && (
              <Link
                href="/pesan/profil"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#ecd8bf] bg-white px-4 py-2 text-xs font-medium text-[#5f4d3f] transition hover:bg-[#f7eddf]"
              >
                <User size={13} /> Profil pelanggan
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => loadPortal().catch(() => undefined)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#ecd8bf] bg-white px-4 py-2 text-xs font-medium text-[#5f4d3f] transition hover:bg-[#f7eddf] disabled:opacity-60"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Segarkan status
          </button>
        </div>

        {error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
        {deleteError && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{deleteError}</div>}

        {loading ? (
          <div className="mt-10 rounded-[1.5rem] border border-[#ecd8bf] bg-white p-10 text-center text-sm font-medium text-[#6f5d4f]">
            Memuat pesanan...
          </div>
        ) : (
          <>
            {!hasOrders && !data?.profile && !hasDrafts && (
              <div className="mt-8 rounded-[1.6rem] border border-dashed border-[#ecd8bf] bg-[#fffaf3] p-8 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#c55a2b]/10 text-[#c55a2b]">
                  <PackageSearch size={22} />
                </div>
                <p className="mt-3 text-lg font-semibold text-[#2f241c]">Pesananmu belum terhubung.</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6f5d4f]">
                  Verifikasi nomor WhatsApp lewat chat untuk menarik pesanan dan alamatmu secara otomatis — tanpa form login.
                </p>
                <Link
                  href="/pesan?verify=wa"
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#c55a2b] px-5 py-2.5 font-medium text-white transition hover:bg-[#ae4d23]"
                >
                  Verifikasi WhatsApp <ArrowRight size={15} />
                </Link>
              </div>
            )}

            {!hasOrders && !data?.profile && hasDrafts && (
              <div className="mt-8 rounded-[1.6rem] border border-dashed border-[#ecd8bf] bg-[#fffaf3] p-8 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#c55a2b]/10 text-[#c55a2b]">
                  <ShoppingBag size={22} />
                </div>
                <p className="mt-3 text-lg font-semibold text-[#2f241c]">Kamu punya keranjang tersimpan.</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6f5d4f]">
                  Verifikasi nomor WhatsApp untuk menyimpan keranjang dan pesananmu di akun ini.
                </p>
                <Link
                  href="/pesan?verify=wa"
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#c55a2b] px-5 py-2.5 font-medium text-white transition hover:bg-[#ae4d23]"
                >
                  Verifikasi WhatsApp <ArrowRight size={15} />
                </Link>
              </div>
            )}

            {!hasOrders && data?.profile && !hasDrafts && (
              <div className="mt-8 rounded-[1.6rem] border border-dashed border-[#ecd8bf] bg-[#fffaf3] p-8 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#c55a2b]/10 text-[#c55a2b]">
                  <PackageSearch size={22} />
                </div>
                <p className="mt-3 text-lg font-semibold text-[#2f241c]">Belum ada pesanan yang terhubung.</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6f5d4f]">
                  Buat pesanan lewat chat. Kalau kamu sudah pernah pesan sebelumnya, bilang aja ke chatbot — dia akan verifikasi nomor WhatsApp dan pesananmu langsung muncul di sini.
                </p>
                <Link href="/pesan" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#c55a2b] px-5 py-2.5 font-medium text-white transition hover:bg-[#ae4d23]">
                  Mulai chat <ArrowRight size={15} />
                </Link>
              </div>
            )}

            {latestOrder && (
              <div className="mt-8 grid gap-3 md:grid-cols-3">
                <MetricCard label="Pesanan terakhir" value={latestOrder.kodePesanan || latestOrder.idTransaksi} />
                <MetricCard label="Status order" value={humanize(latestOrder.orderStatus)} />
                <MetricCard label="Total terakhir" value={formatRupiah(latestOrder.totalBayar)} />
              </div>
            )}

            {activeOrders.length > 0 && (
              <section className="mt-10" data-testid="section-active-orders">
                <div className="flex items-center gap-2">
                  <Loader2 size={18} className="text-[#c55a2b]" />
                  <h2 className="text-xl font-semibold">Sedang diproses</h2>
                  <span className="rounded-full bg-[#c55a2b]/10 px-2 py-0.5 text-[11px] font-semibold text-[#c55a2b]">{activeOrders.length}</span>
                </div>
                <div className="mt-4 space-y-3">
                  {activeOrders.map((order) => (
                    <OrderCard key={order.idTransaksi} order={order} deletingId={deletingId} onDelete={handleDeleteOrder} />
                  ))}
                </div>
              </section>
            )}

            {hasDrafts && data?.profile && (
              <section className="mt-10" data-testid="section-drafts">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={18} className="text-[#7f9f3e]" />
                  <h2 className="text-xl font-semibold">Draft pesanan</h2>
                  <span className="rounded-full bg-[#7f9f3e]/10 px-2 py-0.5 text-[11px] font-semibold text-[#3d5a13]">{data.drafts.length}</span>
                </div>
                <p className="mt-1 text-sm text-[#6f5d4f]">Keranjang yang belum kamu checkout. Lanjutkan belanja dari chat.</p>
                <div className="mt-4 space-y-3">
                  {(data.drafts || []).map((draft) => (
                    <article key={draft.cartId} className="rounded-[1.3rem] border border-[#f0dfca] bg-[#fffaf3] p-4" data-testid="draft-card">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{draft.itemCount} item · {formatRupiah(draft.total)}</p>
                          <p className="mt-1 truncate text-sm text-[#6f5d4f]">{draft.preview || 'Keranjang tersimpan'}</p>
                          <p className="mt-1 text-xs text-[#9b8772]">Terakhir diubah {new Date(draft.updatedAt).toLocaleString('id-ID')}</p>
                        </div>
                        <Link
                          href="/pesan"
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#2f241c] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#47382d]"
                        >
                          Lanjut belanja <ArrowRight size={15} />
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {historyOrders.length > 0 && (
              <section className="mt-10" data-testid="section-history">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-[#9b8772]" />
                  <h2 className="text-xl font-semibold">Riwayat</h2>
                </div>
                <div className="mt-4 space-y-3">
                  {historyOrders.map((order) => (
                    <OrderCard key={order.idTransaksi} order={order} deletingId={deletingId} onDelete={handleDeleteOrder} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function OrderCard({ order, deletingId, onDelete }: { order: PortalOrder; deletingId: string | null; onDelete: (order: PortalOrder) => void }) {
  const kode = order.kodePesanan || order.idTransaksi;
  const isDeleting = deletingId === kode;
  const deletable = canDeleteOrder(order);

  return (
    <article className="rounded-[1.3rem] border border-[#f0dfca] bg-[#fffaf3] p-4" data-testid="order-card">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-lg font-semibold">{order.kodePesanan || order.idTransaksi}</p>
          <p className="mt-1 text-sm text-[#6f5d4f]">{new Date(order.waktuSimpan).toLocaleString('id-ID')}</p>
          <p className="mt-2 text-sm text-[#6f5d4f]">{order.alamatPenerima || 'Alamat pengiriman belum tercatat.'}</p>
        </div>
        <div className="text-left md:text-right">
          <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${paymentTone(order).className}`}>{paymentTone(order).label}</span>
          <p className="mt-1.5 text-sm font-medium text-[#7a6758]">{humanize(order.orderStatus)}</p>
          <p className="mt-1 text-sm text-[#7a6758]">{humanize(order.statusPembayaran || order.paymentStatus)}</p>
          <p className="mt-2 text-lg font-semibold">{formatRupiah(order.totalBayar)}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={`/pesan/status/${encodeURIComponent(kode)}${order.statusToken ? `?token=${encodeURIComponent(order.statusToken)}` : ''}`}
          className="rounded-full bg-[#2f241c] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#47382d]"
        >
          Lihat detail
        </Link>
        {order.paymentMethod !== 'cod' && order.paymentStatus !== 'verified' && (
          <Link
            href={`/pesan/status/${encodeURIComponent(kode)}${order.statusToken ? `?token=${encodeURIComponent(order.statusToken)}` : ''}`}
            className="rounded-full border border-[#ecd8bf] bg-white px-4 py-2 text-sm font-medium text-[#2f241c] transition hover:bg-[#f7eddf]"
          >
            Lanjut bayar
          </Link>
        )}
        {deletable && (
          <button
            type="button"
            data-testid="delete-order-button"
            onClick={() => {
              if (window.confirm(`Hapus pesanan ${kode}? Pesanan yang belum diproses akan dihapus dari daftar.`)) onDelete(order);
            }}
            disabled={isDeleting}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60"
          >
            {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} {isDeleting ? 'Menghapus...' : 'Hapus'}
          </button>
        )}
      </div>
    </article>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] bg-[linear-gradient(135deg,#2f241c_0%,#4b382d_100%)] p-5 text-white shadow-[0_14px_30px_rgba(47,36,28,0.14)]">
      <p className="text-sm text-white/60">{label}</p>
      <p className="mt-2 break-words text-xl font-semibold">{value}</p>
    </div>
  );
}

function humanize(value: string | null | undefined) {
  if (!value) return '-';
  return value.replace(/_/g, ' ');
}
