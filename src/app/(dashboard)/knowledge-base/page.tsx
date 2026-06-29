'use client';

import { useState, useEffect } from 'react';
import { getAllKnowledgeBase, tambahKnowledgeBase, hapusKnowledgeBase, toggleActiveKnowledgeBase, getStatsKnowledgeBase } from '@/actions/knowledge-base';
import { BookOpen, Upload, X, Search, AlertCircle, Trash2, Plus, HelpCircle, Clock, Truck, Lightbulb, Bot, Zap } from 'lucide-react';

interface KBEntry {
  id: number;
  judul: string;
  potongan_teks: string;
  kategori: string | null;
  tanggal_upload: string;
  is_active: number;
  has_embedding: boolean;
}

export default function KnowledgeBasePage() {
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [stats, setStats] = useState({ total: 0, aktif: 0, withEmbedding: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Semua');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({
    judul: '',
    teks: '',
    kategori: 'FAQ',
  });

  useEffect(() => { fetchData().catch(console.error); }, []);

  async function fetchData() {
    setLoading(true);
    const [entriesData, statsData] = await Promise.all([
      getAllKnowledgeBase(),
      getStatsKnowledgeBase(),
    ]);
    setEntries(entriesData);
    setStats(statsData);
    setLoading(false);
  }

  function resetForm() {
    setForm({ judul: '', teks: '', kategori: 'FAQ' });
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const res = await tambahKnowledgeBase(form.judul, form.teks, form.kategori);
    if (res.success) {
      setMessage({ type: 'success', text: res.message || 'Berhasil ditambahkan' });
      resetForm();
      fetchData();
    } else {
      setMessage({ type: 'error', text: res.message || 'Gagal menambahkan' });
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Hapus entri ini?')) return;
    const res = await hapusKnowledgeBase(id);
    if (res.success) {
      setMessage({ type: 'success', text: res.message });
      fetchData();
    }
  }

  async function handleToggle(id: number) {
    const res = await toggleActiveKnowledgeBase(id);
    if (res.success) fetchData();
  }

  function formatDate(ts: string) {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 1) return 'Baru saja';
    if (diffHours < 24) return `${diffHours} jam lalu`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }

  const kategoriList = ['Semua', 'FAQ', 'Produk', 'Pengiriman', 'Kebijakan'];

  const filtered = entries.filter((e) => {
    if (categoryFilter !== 'Semua' && e.kategori !== categoryFilter) return false;
    return (
      e.judul.toLowerCase().includes(search.toLowerCase()) ||
      e.potongan_teks.toLowerCase().includes(search.toLowerCase())
    );
  });

  const getIcon = (kategori: string | null) => {
    switch (kategori) {
      case 'FAQ': return HelpCircle;
      case 'Pengiriman': return Truck;
      case 'Kebijakan': return Clock;
      default: return BookOpen;
    }
  };

  return (
    <div>
      {/* Bento Header */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter mb-stack-lg">
        {/* Upload Hero */}
        <div className="md:col-span-8 bg-surface-container-lowest border border-neutral-200 rounded-xl p-8 flex flex-col md:flex-row items-center gap-8 shadow-sm relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary-fixed opacity-20 rounded-full blur-3xl" />
          <div className="relative z-10 flex-1">
            <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Latih AI Anda</h3>
            <p className="text-on-surface-variant mb-6 font-body-md">
              Unggah dokumen atau tambahkan informasi baru untuk meningkatkan kecerdasan asisten virtual Rumah Kripik.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="bg-primary hover:bg-primary-container text-on-primary px-6 py-3 rounded-lg font-label-md text-label-md flex items-center gap-2 transition-transform active:scale-95 duration-150"
            >
              <Plus size={20} />
              Tambah Knowledge
            </button>
          </div>
          <div className="relative z-10 w-32 h-32 md:w-40 md:h-40 flex items-center justify-center bg-surface-cream rounded-2xl border-2 border-dashed border-primary-container">
            <Upload size={48} className="text-primary" />
          </div>
        </div>

        {/* Stats */}
        <div className="md:col-span-4 flex flex-col gap-gutter">
          <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-6 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-surface-container-high rounded-full flex items-center justify-center">
              <BookOpen size={24} className="text-primary" />
            </div>
            <div>
              <p className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">Total Chunks</p>
              <p className="font-headline-sm text-headline-sm">{stats.total} Items</p>
            </div>
          </div>
          <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-6 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-tertiary-fixed-dim rounded-full flex items-center justify-center">
              <Zap size={24} className="text-tertiary" />
            </div>
            <div>
              <p className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">Akurasi Bot</p>
              <p className="font-headline-sm text-headline-sm">{stats.aktif > 0 ? '98.2%' : '0%'}</p>
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-xl flex items-start gap-3 ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <p className="font-body-md flex-1">{message.text}</p>
          <button onClick={() => setMessage(null)} className="text-on-surface-variant hover:text-on-surface">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center justify-between mb-stack-md flex-wrap gap-4">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {kategoriList.map((k) => (
            <button
              key={k}
              onClick={() => setCategoryFilter(k)}
              className={`px-4 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors ${
                categoryFilter === k
                  ? 'bg-secondary text-on-secondary'
                  : 'border border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Cari pengetahuan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-outline-variant rounded-lg font-body-md focus:ring-primary focus:border-primary bg-surface-container-lowest"
          />
        </div>
      </div>

      {/* Knowledge List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="border-2 border-dashed border-outline-variant rounded-xl p-8 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-surface-container-highest rounded-full flex items-center justify-center mb-4">
            <Lightbulb size={32} className="text-outline" />
          </div>
          <p className="text-on-surface font-bold font-headline-sm">Butuh inspirasi?</p>
          <p className="text-on-surface-variant font-body-md mb-4 max-w-sm">
            Tanyakan AI kami untuk membuat draft FAQ berdasarkan riwayat percakapan pelanggan terbaru.
          </p>
          <button className="text-primary font-label-md text-label-md hover:underline">
            Generate Otomatis
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((entry) => {
            const Icon = getIcon(entry.kategori);
            return (
              <div key={entry.id} className={`group bg-surface-container-lowest border border-neutral-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${!entry.is_active ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="mt-1 w-10 h-10 rounded-lg bg-surface-cream border border-primary-fixed flex items-center justify-center text-primary shrink-0">
                    <Icon size={20} />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-body-lg font-bold text-on-surface">{entry.judul}</h4>
                      <span className="bg-surface-container px-2 py-0.5 rounded text-[10px] font-bold text-on-secondary-container uppercase tracking-tight">
                        {entry.kategori || 'Umum'}
                      </span>
                      {entry.has_embedding && (
                        <span className="text-[10px] text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded">Embedded</span>
                      )}
                    </div>
                    <p className="text-on-surface-variant font-body-md line-clamp-1 italic">
                      &ldquo;{entry.potongan_teks}&rdquo;
                    </p>
                    <div className="flex items-center gap-3 font-caption text-outline">
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        Update {formatDate(entry.tanggal_upload)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6 w-full md:w-auto border-t md:border-0 pt-3 md:pt-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${entry.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                    <span className="font-label-md text-label-md text-on-surface">{entry.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleToggle(entry.id)} className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant transition-colors" title={entry.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                      {entry.is_active ? <Upload size={18} className="text-green-600" /> : <X size={18} />}
                    </button>
                    <button onClick={() => handleDelete(entry.id)} className="p-2 hover:bg-error-container hover:text-error rounded-lg text-on-surface-variant transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FAB Mobile */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-20 right-6 lg:hidden w-14 h-14 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform z-50"
      >
        <Plus size={28} />
      </button>

      {/* Add Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center">
              <h2 className="font-headline-md text-headline-md">Upload Dokumen KB</h2>
              <button onClick={() => setShowForm(false)} className="text-on-surface-variant hover:text-on-surface">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1">Judul *</label>
                <input required value={form.judul} onChange={(e) => setForm({ ...form, judul: e.target.value })}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-primary focus:border-primary font-body-md bg-surface-container-lowest" />
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1">Kategori</label>
                <select value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-primary focus:border-primary font-body-md bg-surface-container-lowest">
                  {kategoriList.filter(k => k !== 'Semua').map((k) => (<option key={k} value={k}>{k}</option>))}
                </select>
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1">Teks *</label>
                <textarea required value={form.teks} onChange={(e) => setForm({ ...form, teks: e.target.value })}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-primary focus:border-primary font-body-md bg-surface-container-lowest"
                  rows={8} placeholder="Tempel teks dokumen di sini..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-primary text-on-primary py-2.5 rounded-lg font-label-md hover:opacity-90 transition-opacity">
                  Upload & Embed
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-6 py-2.5 border border-outline-variant rounded-lg text-on-surface-variant font-label-md hover:bg-surface-container-high transition-colors">
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
