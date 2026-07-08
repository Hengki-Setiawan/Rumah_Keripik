'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { catatPenjualanOffline, getPiutangBelumLunas, tandaiPiutangLunas, getAllTransaksi, getActiveOrderDrafts } from '@/actions/transaksi';
import { getAllProdukAktif } from '@/actions/produk';
import { getAllWarungAktif } from '@/actions/warung';
import { useToast } from '@/components/ui/toast';
import { formatRupiah } from '@/lib/utils';
import { PaymentVerificationPanel } from '@/components/transaksi/PaymentVerificationPanel';
import { DeliveryZonesManager } from '@/components/dashboard/DeliveryZonesManager';
import dynamic from 'next/dynamic';
import {
  Plus,
  X,
  DollarSign,
  CheckCircle,
  ShoppingCart,
  Clock,
  Filter,
  FileText,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  User,
  Store,
  Shield,
  MapPin,
} from 'lucide-react';

const MiniMap = dynamic(() => import('@/components/maps/MiniDeliveryMap').then((m) => ({ default: m.MiniDeliveryMap })), { ssr: false });

export default function TransaksiHubPage() {
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'riwayat' | 'catat' | 'piutang' | 'verifikasi' | 'zona'>('riwayat');

  // Unified Lists
  const [transactions, setTransactions] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(15);
  const [loading, setLoading] = useState(true);

  // Form & Selection Lists
  const [produkList, setProdukList] = useState<any[]>([]);
  const [warungList, setWarungList] = useState<any[]>([]);
  const [piutang, setPiutang] = useState<any[]>([]);

  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'Online_WA' | 'Offline_Gudang'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'Lunas' | 'Piutang' | 'Tidak_Lunas' | 'Menunggu_Bayar' | 'Menunggu_Verifikasi' | 'Dibatalkan'>('all');

  // Form State
  const [form, setForm] = useState({
    tipePelanggan: 'walk-in' as 'walk-in' | 'wa' | 'warung',
    no_wa_pelanggan: '',
    id_warung: '',
    items: [{ id_produk: '', qty: 1 }] as { id_produk: string; qty: number }[],
    status_pembayaran: 'Lunas' as 'Lunas' | 'Piutang' | 'Tidak_Lunas',
    tanggal_jatuh_tempo: '',
    catatan: '',
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Delivery Tracking
  const [trackingTx, setTrackingTx] = useState<string | null>(null);

  useEffect(() => {
    fetchMainData().catch(console.error);
    const interval = setInterval(() => fetchMainData(true).catch(console.error), 10_000);
    return () => clearInterval(interval);
  }, [currentPage, typeFilter, paymentFilter]);

  useEffect(() => {
    const nextTab = searchParams.get('tab');
    if (nextTab === 'riwayat' || nextTab === 'catat' || nextTab === 'piutang' || nextTab === 'verifikasi' || nextTab === 'zona') {
      setActiveTab(nextTab);
    }
  }, [searchParams]);

  useEffect(() => {
    // Load lists for the form once
    async function loadFormOptions() {
      const [p, w, piut] = await Promise.all([
        getAllProdukAktif(),
        getAllWarungAktif(),
        getPiutangBelumLunas(),
      ]);
      setProdukList(p);
      setWarungList(w);
      setPiutang(piut);
    }
    loadFormOptions().catch(console.error);
  }, []);

  async function fetchMainData(silent = false) {
    if (!silent) setLoading(true);
    const res = await getAllTransaksi(currentPage, limit);
    const activeDrafts = await getActiveOrderDrafts();
    setTransactions(res.data);
    setDrafts(activeDrafts);
    setTotalCount(res.total);
    if (!silent) setLoading(false);
  }

  // Form helpers
  function addItem() {
    setForm({ ...form, items: [...form.items, { id_produk: '', qty: 1 }] });
  }

  function removeItem(i: number) {
    if (form.items.length > 1) {
      const items = form.items.filter((_, idx) => idx !== i);
      setForm({ ...form, items });
    }
  }

  function updateItem(i: number, field: 'id_produk' | 'qty', value: string | number) {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: value };
    setForm({ ...form, items });
  }

  function getHarga(id_produk: string) {
    const p = produkList.find((pr) => pr.id_produk === id_produk);
    return p ? p.harga_jual : 0;
  }

  function getTotal() {
    return form.items.reduce((sum, item) => {
      return sum + (getHarga(item.id_produk) * item.qty);
    }, 0);
  }

  // Submit Offline Transaksi
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const validItems = form.items.filter((i) => i.id_produk && i.qty > 0);
    if (validItems.length === 0) {
      addToast('error', 'Minimal pilih 1 item produk');
      return;
    }

    // Check stocks
    for (const item of validItems) {
      const p = produkList.find((pr) => pr.id_produk === item.id_produk);
      if (p && p.stok_gudang_utama < item.qty) {
        addToast('error', `Stok ${p.nama_produk} kurang (tersedia: ${p.stok_gudang_utama})`);
        return;
      }
    }

    if (form.status_pembayaran === 'Piutang' && !form.tanggal_jatuh_tempo) {
      addToast('error', 'Tanggal jatuh tempo wajib diisi untuk piutang');
      return;
    }

    const res = await catatPenjualanOffline({
      no_wa_pelanggan: form.tipePelanggan === 'wa' ? form.no_wa_pelanggan : undefined,
      id_warung: form.tipePelanggan === 'warung' ? form.id_warung : undefined,
      tipe_penjualan: 'Offline_Gudang',
      status_pembayaran: form.status_pembayaran,
      tanggal_jatuh_tempo: form.status_pembayaran === 'Piutang' ? form.tanggal_jatuh_tempo : undefined,
      items: validItems.map((i) => ({ id_produk: i.id_produk, qty_terjual: i.qty })),
      catatan: form.catatan || undefined,
    });

    if (res.success) {
      addToast('success', res.message || 'Transaksi berhasil dicatat');
      setForm({
        tipePelanggan: 'walk-in',
        no_wa_pelanggan: '',
        id_warung: '',
        items: [{ id_produk: '', qty: 1 }],
        status_pembayaran: 'Lunas',
        tanggal_jatuh_tempo: '',
        catatan: '',
      });
      setActiveTab('riwayat');
      fetchMainData();
      const piut = await getPiutangBelumLunas();
      setPiutang(piut);
    } else {
      addToast('error', res.message || 'Gagal menyimpan transaksi');
    }
  }

  // Debt action
  async function handleTandaiLunas(id: string) {
    if (!confirm('Tandai tagihan piutang ini sebagai LUNAS?')) return;
    const res = await tandaiPiutangLunas(id);
    if (res.success) {
      addToast('success', 'Piutang berhasil diselesaikan');
      const piut = await getPiutangBelumLunas();
      setPiutang(piut);
      fetchMainData();
    } else {
      addToast('error', 'Gagal update status piutang');
    }
  }

  async function handleOrderStatus(id: string, orderStatus: 'processing' | 'shipping' | 'completed' | 'cancelled') {
    const labels = { processing: 'diproses', shipping: 'dikirim', completed: 'selesai', cancelled: 'dibatalkan' };
    if (!confirm(`Tandai order ini ${labels[orderStatus]} dan kirim update ke chat?`)) return;
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderStatus }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      addToast('success', `Status order ${labels[orderStatus]} dan notifikasi chat dikirim`);
      fetchMainData();
    } else {
      addToast('error', data.error || 'Gagal update status order');
    }
  }

  // Helpers
  function formatDate(ts: string) {
    return new Date(ts + 'Z').toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });
  }

  function getStatusClass(status: string) {
    if (status === 'Lunas') return 'bg-green-100 text-green-700';
    if (status === 'Menunggu_Verifikasi') return 'bg-orange-50 text-orange-700 ring-1 ring-orange-100';
    if (status === 'Menunggu_Bayar') return 'bg-blue-100 text-blue-700';
    if (status === 'Piutang') return 'bg-red-100 text-red-700';
    if (status === 'Dibatalkan') return 'bg-gray-200 text-gray-600';
    return 'bg-gray-100 text-gray-700';
  }

  function formatStatus(status: string) {
    return status.replace(/_/g, ' ');
  }

  // Filters locally or dynamically
  const filteredTransactions = transactions.filter((t) => {
    if (typeFilter !== 'all' && t.tipe_penjualan !== typeFilter) return false;
    if (paymentFilter !== 'all' && t.status_pembayaran !== paymentFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Transaksi & Pengiriman</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            Pantau pesanan, verifikasi pembayaran, piutang, dan zona pengiriman dari satu halaman kerja
          </p>
        </div>
        {activeTab !== 'catat' && activeTab !== 'zona' && (
          <button
            onClick={() => setActiveTab('catat')}
            className="bg-primary hover:opacity-90 text-on-primary px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all shrink-0"
          >
            <Plus size={18} /> Catat Transaksi Offline
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5">
          <p className="text-sm text-on-surface-variant">Total Tagihan Piutang</p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-error">
            {formatRupiah(piutang.reduce((s, p) => s + p.total_bayar, 0))}
          </p>
          <p className="text-xs text-on-surface-variant/70 mt-1">Dari {piutang.length} tagihan belum lunas</p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5">
          <p className="text-sm text-on-surface-variant">Total Transaksi</p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-on-surface">{totalCount}</p>
          <p className="text-xs text-on-surface-variant/70 mt-1">Termasuk penjualan online & offline</p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5">
          <p className="text-sm text-on-surface-variant">Piutang Aktif</p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-on-surface">{piutang.length}</p>
          <p className="text-xs text-on-surface-variant/70 mt-1">Butuh penagihan / follow-up segera</p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5">
          <p className="text-sm text-on-surface-variant">Profil / Order Pending</p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-on-surface">{drafts.length}</p>
          <p className="text-xs text-on-surface-variant/70 mt-1">Pelanggan masih di flow chatbot</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-container-lowest border border-neutral-200 rounded-xl p-1 w-full md:w-fit">
        {[
          { key: 'riwayat' as const, label: 'Semua Transaksi', icon: ShoppingCart },
          { key: 'verifikasi' as const, label: 'Verifikasi', icon: Shield },
          { key: 'zona' as const, label: 'Zona Pengiriman', icon: MapPin },
          { key: 'catat' as const, label: 'Catat Penjualan (Offline)', icon: Plus },
          { key: 'piutang' as const, label: 'Daftar Piutang', icon: DollarSign, count: piutang.length },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-label-md text-label-md transition-all flex-1 md:flex-initial justify-center whitespace-nowrap ${
                isActive ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <Icon size={16} />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-white/20' : 'bg-surface-container-high text-on-surface-variant'}`}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* --- TAB 1: ALL TRANSACTIONS --- */}
      {activeTab === 'riwayat' && (
        <div className="space-y-4">
          {drafts.length > 0 && (
              <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={16} className="text-on-surface-variant" />
                <h3 className="font-semibold text-on-surface">Antrian Chatbot Belum Selesai</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {drafts.slice(0, 6).map((draft) => (
                    <div key={draft.id} className="rounded-xl border border-outline-variant bg-surface-container-low p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-on-surface">{draft.nama_pelanggan || 'Pelanggan Chatbot'}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-on-surface-variant font-medium">
                        {formatStatus(draft.status)}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-on-surface-variant mt-1">{draft.no_wa_pelanggan}</p>
                    <p className="text-[11px] text-on-surface-variant mt-1">Update: {formatDate(draft.updated_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-4 flex-wrap bg-surface-container-lowest border border-neutral-200 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-on-surface-variant">
              <Filter size={16} />
              <span className="font-label-md text-label-md">Filter:</span>
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-3 py-1.5 border border-outline-variant rounded-lg text-sm bg-surface-container-lowest focus:ring-primary focus:outline-none"
            >
              <option value="all">Semua Tipe Penjualan</option>
              <option value="Online_WA">Online (Chatbot)</option>
              <option value="Offline_Gudang">Offline (Manual Gudang)</option>
            </select>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as any)}
              className="px-3 py-1.5 border border-outline-variant rounded-lg text-sm bg-surface-container-lowest focus:ring-primary focus:outline-none"
            >
              <option value="all">Semua Pembayaran</option>
              <option value="Lunas">Lunas</option>
              <option value="Piutang">Piutang</option>
              <option value="Tidak_Lunas">Tidak Lunas</option>
              <option value="Menunggu_Bayar">Menunggu Bayar</option>
              <option value="Menunggu_Verifikasi">Menunggu Verifikasi</option>
              <option value="Dibatalkan">Dibatalkan</option>
            </select>
          </div>

          {/* List Table */}
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-surface-container rounded-xl" />)}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-12 text-center">
              <ShoppingCart size={48} className="mx-auto mb-3 text-outline-variant" />
              <p className="font-body-md text-on-surface-variant">Belum ada transaksi terekam</p>
            </div>
          ) : (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-container">
                    <tr className="font-label-md text-label-md text-on-surface-variant">
                      <th className="px-4 py-3 text-left">ID Transaksi</th>
                      <th className="px-4 py-3 text-left">Pelanggan / Warung</th>
                      <th className="px-4 py-3 text-left">Tanggal</th>
                      <th className="px-4 py-3 text-right">Total Bayar</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Tipe</th>
                      <th className="px-4 py-3 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 font-body-md">
                    {filteredTransactions.map((tx) => (
                      <>
                      <tr key={tx.id_transaksi} className="hover:bg-surface-cream transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs font-semibold text-primary">#{tx.id_transaksi}</p>
                          {tx.kode_pesanan && (
                            <p className="text-[10px] text-on-surface-variant/65 uppercase tracking-wide">Ref: {tx.kode_pesanan}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {tx.nama_pelanggan ? (
                            <div className="flex items-center gap-1.5">
                              <User size={14} className="text-green-600 shrink-0" />
                              <span className="font-semibold">{tx.nama_pelanggan}</span>
                            </div>
                          ) : tx.nama_warung ? (
                            <div className="flex items-center gap-1.5">
                              <Store size={14} className="text-purple-600 shrink-0" />
                              <span className="font-semibold text-purple-900">{tx.nama_warung}</span>
                            </div>
                          ) : (
                            <span className="text-outline/50 italic">Walk-in Customer</span>
                          )}
                          {(tx.no_wa_pelanggan || tx.id_warung) && (
                            <p className="text-[10px] text-on-surface-variant font-mono mt-0.5">{tx.no_wa_pelanggan || tx.id_warung}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant text-sm whitespace-nowrap">{formatDate(tx.waktu_simpan)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-sm text-on-surface">{formatRupiah(tx.total_bayar)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium ${getStatusClass(tx.status_pembayaran)}`}>
                            {formatStatus(tx.status_pembayaran)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${
                            tx.tipe_penjualan === 'Online_WA' ? 'bg-blue-50 text-blue-700' : 'bg-neutral-100 text-neutral-700'
                          }`}>
                            {tx.tipe_penjualan === 'Online_WA' ? <Smartphone size={10} /> : <FileText size={10} />}
                            {tx.tipe_penjualan === 'Online_WA' ? 'ONLINE' : 'OFFLINE'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {tx.invoice_url && (
                              <a
                                href={tx.invoice_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
                                title="Download Invoice PDF"
                              >
                                <FileText size={16} />
                              </a>
                            )}
                            <button
                              data-testid={`tx-processing-${tx.id_transaksi}`}
                              onClick={() => handleOrderStatus(tx.id_transaksi, 'processing')}
                               className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700"
                              title="Tandai diproses + notify chat"
                            >Proses</button>
                            <button
                              data-testid={`tx-shipping-${tx.id_transaksi}`}
                              onClick={() => handleOrderStatus(tx.id_transaksi, 'shipping')}
                               className="rounded-md bg-neutral-100 px-2 py-1 text-[10px] font-medium text-neutral-700"
                              title="Tandai dikirim + notify chat"
                            >Kirim</button>
                            <button
                              data-testid={`tx-completed-${tx.id_transaksi}`}
                              onClick={() => handleOrderStatus(tx.id_transaksi, 'completed')}
                               className="rounded-md bg-green-50 px-2 py-1 text-[10px] font-medium text-green-700"
                              title="Tandai selesai + notify chat"
                            >Selesai</button>
                            <button
                              onClick={() => setTrackingTx(trackingTx === tx.id_transaksi ? null : tx.id_transaksi)}
                              className={`p-1.5 rounded-lg transition-colors ${trackingTx === tx.id_transaksi ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-primary hover:bg-surface-container'}`}
                              title={trackingTx === tx.id_transaksi ? 'Tutup' : 'Lihat Lokasi'}
                            >
                              <MapPin size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {trackingTx === tx.id_transaksi && (
                        <tr key={`${tx.id_transaksi}-map`}>
                          <td colSpan={7} className="px-4 py-3 bg-surface-cream">
                            <div className="h-48 rounded-xl overflow-hidden border border-outline-variant/30">
                              <MiniMap
                                lat={tx.lat_pengiriman ? Number(tx.lat_pengiriman) : -0.5022}
                                lng={tx.lng_pengiriman ? Number(tx.lng_pengiriman) : 117.1536}
                                height={192}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-outline-variant/10 flex justify-between items-center">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(c => Math.max(1, c - 1))}
                    className="flex items-center gap-1 text-sm font-medium text-on-surface hover:text-primary transition-colors disabled:opacity-50"
                  >
                    <ChevronLeft size={16} /> Prev
                  </button>
                  <span className="text-xs text-on-surface-variant">Page {currentPage} of {totalPages}</span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))}
                    className="flex items-center gap-1 text-sm font-medium text-on-surface hover:text-primary transition-colors disabled:opacity-50"
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 2: VERIFIKASI PEMBAYARAN --- */}
      {activeTab === 'verifikasi' && <PaymentVerificationPanel compactHeader />}

      {activeTab === 'zona' && (
        <DeliveryZonesManager />
      )}

      {/* --- TAB 3: CATAT PENJUALAN OFFLINE --- */}
      {activeTab === 'catat' && (
        <div className="bg-surface-container-lowest border border-neutral-200 p-6 rounded-xl shadow-sm max-w-2xl">
          <div className="mb-4">
            <h3 className="font-headline-sm text-headline-sm text-on-surface">Input Transaksi Manual</h3>
            <p className="text-on-surface-variant font-body-md mt-1">Masukkan data pembelian secara langsung untuk mengurangi stok gudang otomatis</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tipe Pelanggan */}
            <div>
              <label className="block font-label-md text-label-md text-on-surface mb-2">Pilih Jenis Pelanggan</label>
              <div className="flex gap-2">
                {(['walk-in', 'wa', 'warung'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, tipePelanggan: t })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      form.tipePelanggan === t ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface hover:bg-outline-variant/30'
                    }`}
                  >
                    {t === 'walk-in' ? 'Walk-in' : t === 'wa' ? 'Via WA Chatbot' : 'Warung Mitra'}
                  </button>
                ))}
              </div>
            </div>

            {form.tipePelanggan === 'wa' && (
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1">No. WA Pelanggan</label>
                <input
                  value={form.no_wa_pelanggan}
                  onChange={(e) => setForm({ ...form, no_wa_pelanggan: e.target.value })}
                  placeholder="6281234567890"
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface-container-lowest focus:ring-primary focus:border-primary font-body-md focus:outline-none"
                />
              </div>
            )}

            {form.tipePelanggan === 'warung' && (
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1">Pilih Warung</label>
                <select
                  value={form.id_warung}
                  onChange={(e) => setForm({ ...form, id_warung: e.target.value })}
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface-container-lowest focus:ring-primary focus:border-primary font-body-md focus:outline-none"
                >
                  <option value="">-- Pilih Warung --</option>
                  {warungList.map((w) => (
                    <option key={w.id_warung} value={w.id_warung}>{w.nama_warung} ({w.id_warung})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Items */}
            <div className="border border-outline-variant/35 rounded-xl p-4 bg-surface-cream/30 space-y-3">
              <div className="flex justify-between items-center">
                <label className="font-label-md text-label-md text-on-surface font-bold">Produk yang Dibeli</label>
                <button type="button" onClick={addItem} className="text-sm text-primary hover:underline font-semibold">+ Tambah Item</button>
              </div>
              {form.items.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    value={item.id_produk}
                    onChange={(e) => updateItem(i, 'id_produk', e.target.value)}
                    className="flex-1 border border-outline-variant rounded-lg px-3 py-2 bg-surface-container-lowest focus:ring-primary focus:border-primary font-body-md focus:outline-none"
                  >
                    <option value="">-- Pilih Produk --</option>
                    {produkList.map((p) => (
                      <option key={p.id_produk} value={p.id_produk}>
                        {p.nama_produk} - {formatRupiah(p.harga_jual)} (stok: {p.stok_gudang_utama})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={(e) => updateItem(i, 'qty', parseInt(e.target.value) || 0)}
                    className="w-20 border border-outline-variant rounded-lg px-3 py-2 bg-surface-container-lowest focus:ring-primary focus:border-primary font-body-md focus:outline-none"
                  />
                  <button type="button" onClick={() => removeItem(i)} className="text-error hover:opacity-75 p-1 rounded">
                    <X size={20} />
                  </button>
                </div>
              ))}
              <div className="text-right pt-2 border-t border-outline-variant/10">
                <span className="font-body-md text-on-surface-variant mr-2">Subtotal:</span>
                <span className="text-lg font-bold text-primary">{formatRupiah(getTotal())}</span>
              </div>
            </div>

            {/* Pembayaran */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1">Status Pembayaran</label>
                <select
                  value={form.status_pembayaran}
                  onChange={(e) => setForm({ ...form, status_pembayaran: e.target.value as any })}
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface-container-lowest focus:ring-primary focus:border-primary font-body-md focus:outline-none"
                >
                  <option value="Lunas">Lunas (Lunas langsung)</option>
                  <option value="Piutang">Piutang (Hutang tempo)</option>
                  <option value="Tidak_Lunas">Belum Bayar</option>
                </select>
              </div>
              {form.status_pembayaran === 'Piutang' && (
                <div>
                  <label className="block font-label-md text-label-md text-on-surface mb-1">Jatuh Tempo</label>
                  <input
                    type="date"
                    value={form.tanggal_jatuh_tempo}
                    onChange={(e) => setForm({ ...form, ...setJatuhTempoVal(e.target.value) })}
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface-container-lowest focus:ring-primary focus:border-primary font-body-md focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block font-label-md text-label-md text-on-surface mb-1">Catatan</label>
              <textarea
                value={form.catatan}
                onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface-container-lowest focus:ring-primary focus:border-primary font-body-md focus:outline-none"
                rows={2}
                placeholder="Catatan tambahan transaksi..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 bg-primary text-on-primary py-3 rounded-lg font-label-md hover:opacity-90 transition-opacity">
                Simpan & Rekam Transaksi
              </button>
              <button
                type="button"
                onClick={() => {
                  setForm({
                    tipePelanggan: 'walk-in',
                    no_wa_pelanggan: '',
                    id_warung: '',
                    items: [{ id_produk: '', qty: 1 }],
                    status_pembayaran: 'Lunas',
                    tanggal_jatuh_tempo: '',
                    catatan: '',
                  });
                  setActiveTab('riwayat');
                }}
                className="px-6 py-3 border border-outline-variant rounded-lg text-on-surface-variant font-label-md hover:bg-surface-container-high transition-colors"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- TAB 3: TAGIHAN PIUTANG --- */}
      {activeTab === 'piutang' && (
        <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-outline-variant/10">
            <h3 className="font-headline-sm text-headline-sm text-on-surface">Tagihan Piutang Aktif</h3>
            <p className="text-on-surface-variant font-body-md mt-1">Daftar warung atau pelanggan dengan tagihan belum dilunasi</p>
          </div>
          {piutang.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant font-body-md">
              <DollarSign size={48} className="mx-auto mb-2 text-outline-variant" />
              <p>Hebat! Tidak ada piutang tertunggak saat ini</p>
            </div>
          ) : (
            <table className="w-full font-body-md">
              <thead className="bg-surface-container">
                <tr className="font-label-md text-label-md text-on-surface-variant">
                  <th className="text-left px-4 py-3">ID Transaksi</th>
                  <th className="text-left px-4 py-3">Pelanggan/Warung</th>
                  <th className="text-right px-4 py-3">Total Tagihan</th>
                  <th className="text-center px-4 py-3">Jatuh Tempo</th>
                  <th className="text-center px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {piutang.map((p: any) => (
                  <tr key={p.id_transaksi} className="hover:bg-surface-cream transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-primary font-semibold">#{p.id_transaksi}</td>
                    <td className="px-4 py-3 font-semibold">
                      {p.nama_pelanggan || p.nama_warung || <span className="text-outline/50 italic">Walk-in</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-error">{formatRupiah(p.total_bayar)}</td>
                    <td className="px-4 py-3 text-center text-on-surface-variant text-sm font-semibold">
                      {p.tanggal_jatuh_tempo ? new Date(p.tanggal_jatuh_tempo).toLocaleDateString('id-ID') : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleTandaiLunas(p.id_transaksi)}
                        className="flex items-center gap-1 mx-auto text-green-600 hover:text-green-800 text-sm font-bold bg-green-50 px-2.5 py-1 rounded-lg border border-green-200 hover:scale-95 transition-transform"
                      >
                        <CheckCircle size={14} /> Tandai Lunas
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );

  function setJatuhTempoVal(val: string) {
    return { tanggal_jatuh_tempo: val };
  }
}
