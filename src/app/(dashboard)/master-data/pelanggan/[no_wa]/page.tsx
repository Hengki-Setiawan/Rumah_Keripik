'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Phone, User, MapPin, Tag, Bot, MessageSquare,
  ShoppingCart, ChevronRight, Clock, Plus, X, Package,
  AlertCircle, TrendingUp,
} from 'lucide-react';
import { getPelangganByNoWa, updatePelanggan, updateTags, getTagOptions, getTransaksiByPelanggan, getChatHistoryByPelanggan } from '@/actions/pelanggan';
import { useToast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRupiah } from '@/lib/utils';

type Tab = 'info' | 'transaksi' | 'chat';

export default function CustomerDetailPage() {
  const { no_wa } = useParams<{ no_wa: string }>();
  const router = useRouter();
  const { addToast } = useToast();
  const [customer, setCustomer] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('info');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ nama_pelanggan: '', alamat_pengiriman: '' });
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);

  useEffect(() => {
    fetchData().catch(console.error);
    getTagOptions().then(setTagOptions);
  }, [no_wa]);

  async function fetchData() {
    setLoading(true);
    const [cust, tx, chat] = await Promise.all([
      getPelangganByNoWa(decodeURIComponent(no_wa)),
      getTransaksiByPelanggan(decodeURIComponent(no_wa)),
      getChatHistoryByPelanggan(decodeURIComponent(no_wa)),
    ]);
    setCustomer(cust);
    setTransactions(tx);
    setChatHistory(chat);
    setLoading(false);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    const res = await updatePelanggan(customer.no_wa_pelanggan, editForm);
    addToast(res.success ? 'success' : 'error', res.message);
    if (res.success) {
      setCustomer({ ...customer, ...editForm });
      setEditing(false);
    }
  }

  async function handleAddTag(tag: string) {
    const currentTags = JSON.parse(customer.tags || '[]');
    if (currentTags.includes(tag)) return;
    const newTags = [...currentTags, tag];
    const res = await updateTags(customer.no_wa_pelanggan, newTags);
    if (res.success) {
      setCustomer({ ...customer, tags: JSON.stringify(newTags) });
      addToast('success', `Tag "${tag}" ditambahkan`);
    }
    setShowTagPicker(false);
  }

  async function handleRemoveTag(tag: string) {
    const currentTags = JSON.parse(customer.tags || '[]');
    const newTags = currentTags.filter((t: string) => t !== tag);
    const res = await updateTags(customer.no_wa_pelanggan, newTags);
    if (res.success) {
      setCustomer({ ...customer, tags: JSON.stringify(newTags) });
    }
  }

  function formatDate(ts: string) {
    return new Date(ts + 'Z').toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });
  }

  function formatDateShort(ts: string) {
    const d = new Date(ts + 'Z');
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Hari ini';
    if (days === 1) return 'Kemarin';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }

  const tags = JSON.parse(customer?.tags || '[]');

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 !rounded-xl" />
        <Skeleton className="h-64 !rounded-xl" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-16">
        <User size={48} className="mx-auto mb-3 text-outline-variant" />
        <p className="font-body-md text-on-surface-variant">Pelanggan tidak ditemukan</p>
        <Link href="/master-data/pelanggan" className="text-primary font-label-md mt-4 inline-block hover:underline">
          Kembali ke daftar
        </Link>
      </div>
    );
  }

  const tagColors: Record<string, string> = {
    VIP: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    Prospek: 'bg-blue-100 text-blue-800 border-blue-300',
    Komplain: 'bg-red-100 text-red-800 border-red-300',
    'Pelanggan Baru': 'bg-green-100 text-green-800 border-green-300',
    'Butuh Follow-up': 'bg-orange-100 text-orange-800 border-orange-300',
    'Tidak Aktif': 'bg-gray-100 text-gray-800 border-gray-300',
    Reseller: 'bg-purple-100 text-purple-800 border-purple-300',
    Dropshipper: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  };

  const tabs: { key: Tab; label: string; icon: any; count?: number }[] = [
    { key: 'info', label: 'Info', icon: User },
    { key: 'transaksi', label: 'Transaksi', icon: ShoppingCart, count: transactions.length },
    { key: 'chat', label: 'Riwayat Chat', icon: MessageSquare, count: chatHistory.length },
  ];

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{customer.nama_pelanggan || 'Tanpa Nama'}</h1>
          <p className="font-body-md text-on-surface-variant">Detail pelanggan & riwayat transaksi</p>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-6 mb-gutter">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-16 h-16 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold text-2xl shrink-0">
            {(customer.nama_pelanggan || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="font-headline-sm text-headline-sm text-on-surface">{customer.nama_pelanggan || 'Tanpa Nama'}</h2>
                <div className="flex flex-wrap items-center gap-3 text-on-surface-variant font-body-md">
                  <span className="flex items-center gap-1"><Phone size={14} /> {customer.no_wa_pelanggan}</span>
                  <span className="flex items-center gap-1"><Clock size={14} /> Terakhir aktif: {formatDateShort(customer.terakhir_aktif)}</span>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full font-label-md text-label-md ${
                customer.status_handle === 'AI_Bot' ? 'bg-green-100 text-green-700' : 'bg-secondary-fixed text-secondary'
              }`}>
                <Bot size={12} className="inline mr-1" />
                {customer.status_handle === 'AI_Bot' ? 'AI Bot' : 'Manual Admin'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Tag size={14} className="text-on-surface-variant" />
              {tags.map((tag: string) => (
                <span key={tag} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${tagColors[tag] || 'bg-surface-container text-on-surface border-outline-variant'}`}>
                  {tag}
                  <button onClick={() => handleRemoveTag(tag)} className="hover:opacity-60">
                    <X size={12} />
                  </button>
                </span>
              ))}
              <div className="relative">
                <button
                  onClick={() => setShowTagPicker(!showTagPicker)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-outline-variant text-on-surface-variant text-[11px] hover:bg-surface-container transition-colors"
                >
                  <Plus size={12} /> Tag
                </button>
                {showTagPicker && (
                  <div className="absolute top-full left-0 mt-1 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg p-2 z-10 min-w-[160px]">
                    {tagOptions.filter(t => !tags.includes(t)).map(tag => (
                      <button
                        key={tag}
                        onClick={() => handleAddTag(tag)}
                        className="w-full text-left px-3 py-1.5 rounded-lg text-sm hover:bg-surface-container transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                    {tagOptions.every(t => tags.includes(t)) && (
                      <p className="px-3 py-1.5 text-xs text-on-surface-variant">Semua tag sudah dipilih</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {customer.alamat_pengiriman && (
          <div className="mt-4 flex items-start gap-2 text-on-surface-variant font-body-md pt-4 border-t border-outline-variant/20">
            <MapPin size={16} className="mt-0.5 shrink-0" />
            <span>{customer.alamat_pengiriman}</span>
          </div>
        )}

        {/* Edit Button */}
        {!editing ? (
          <button
            onClick={() => { setEditing(true); setEditForm({ nama_pelanggan: customer.nama_pelanggan || '', alamat_pengiriman: customer.alamat_pengiriman || '' }); }}
            className="mt-4 text-primary font-label-md hover:underline text-sm"
          >
            Edit data pelanggan
          </button>
        ) : (
          <form onSubmit={handleEdit} className="mt-4 pt-4 border-t border-outline-variant/20 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1">Nama</label>
                <input value={editForm.nama_pelanggan} onChange={e => setEditForm(f => ({ ...f, nama_pelanggan: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md" />
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1">Alamat</label>
                <input value={editForm.alamat_pengiriman} onChange={e => setEditForm(f => ({ ...f, alamat_pengiriman: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-primary text-on-primary px-4 py-2 rounded-lg font-label-md hover:opacity-90 transition-opacity">
                Simpan
              </button>
              <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 border border-outline-variant rounded-lg font-label-md text-on-surface-variant hover:bg-surface-container-high transition-colors">
                Batal
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-container-lowest border border-neutral-200 rounded-xl p-1 mb-gutter">
        {tabs.map(t => {
          const Icon = t.icon;
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 flex-1 justify-center px-4 py-2.5 rounded-lg font-label-md text-label-md transition-all ${
                isActive ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <Icon size={16} />
              {t.label}
              {t.count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  isActive ? 'bg-white/20' : 'bg-surface-container-high'
                }`}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tab === 'info' && (
        <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-6 space-y-4">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">Ringkasan Pelanggan</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Transaksi', value: transactions.length.toString(), icon: ShoppingCart },
              { label: 'Total Belanja', value: formatRupiah(transactions.reduce((s, t) => s + t.total_bayar, 0)), icon: TrendingUp },
              { label: 'Status Handle', value: customer.status_handle === 'AI_Bot' ? 'AI Bot' : 'Manual', icon: Bot },
              { label: 'Chat History', value: chatHistory.length.toString(), icon: MessageSquare },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="bg-surface-container-low rounded-xl p-4">
                  <Icon size={18} className="text-primary mb-2" />
                  <p className="font-label-md text-label-md text-on-surface-variant">{s.label}</p>
                  <p className="font-headline-sm text-headline-sm text-on-surface mt-1">{s.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'transaksi' && (
        <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl overflow-hidden">
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-on-surface-variant font-body-md">
              <ShoppingCart size={48} className="mx-auto mb-2 text-outline-variant" />
              Belum ada transaksi
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-container text-on-surface font-label-md uppercase text-[10px] tracking-wider">
                    <th className="px-4 py-3 text-left">Pesanan</th>
                    <th className="px-4 py-3 text-left">Tanggal</th>
                    <th className="px-4 py-3 text-left">Items</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Tipe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {transactions.map((tx: any) => (
                    <tr key={tx.id_transaksi} className="hover:bg-surface-cream transition-colors">
                      <td className="px-4 py-3 font-mono text-mono text-primary">#{tx.id_transaksi}</td>
                      <td className="px-4 py-3 text-on-surface-variant font-body-md">{formatDate(tx.waktu_simpan)}</td>
                      <td className="px-4 py-3 text-on-surface-variant font-body-md text-sm max-w-xs truncate">{tx.items || '-'}</td>
                      <td className="px-4 py-3 text-right font-bold font-body-md">{formatRupiah(tx.total_bayar)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-label-md text-[10px] ${
                          tx.status_pembayaran === 'Lunas' ? 'bg-green-100 text-green-700' :
                          tx.status_pembayaran === 'Piutang' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                        }`}>{tx.status_pembayaran}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-label-md text-[10px] text-on-surface-variant">
                          {tx.tipe_penjualan === 'Online_WA' ? 'WA' : 'Offline'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'chat' && (
        <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-4">
          {chatHistory.length === 0 ? (
            <div className="text-center py-12 text-on-surface-variant font-body-md">
              <MessageSquare size={48} className="mx-auto mb-2 text-outline-variant" />
              Belum ada riwayat chat
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {chatHistory.map((msg: any, i: number) => {
                const isBot = msg.sumber === 'bot';
                const isAdmin = msg.sumber === 'admin';
                const isSystem = msg.sumber === 'sistem';
                return (
                  <div key={i} className={`flex ${isSystem ? 'justify-center' : isBot ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[80%] px-4 py-2.5 rounded-xl font-body-md text-body-md ${
                      isSystem
                        ? 'bg-surface-container text-on-surface-variant text-xs italic text-center'
                        : isBot
                          ? 'bg-surface-container text-on-surface rounded-bl-sm'
                          : 'bg-primary text-on-primary rounded-br-sm'
                    }`}>
                      <p>{msg.teks}</p>
                      <p className={`text-[10px] mt-1 ${isBot ? 'text-on-surface-variant' : 'text-on-primary/70'}`}>
                        {formatDate(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
