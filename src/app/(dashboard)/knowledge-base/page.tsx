'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Upload, Plus, X, Search, Trash2, ToggleLeft, ToggleRight, Zap, AlertCircle } from 'lucide-react';
import { getAllKnowledgeBase, tambahKnowledgeBase, hapusKnowledgeBase, toggleActiveKnowledgeBase, getStatsKnowledgeBase } from '@/actions/knowledge-base';
import { useToast } from '@/components/ui/toast';

interface KBEntry {
  id: number;
  judul: string;
  potongan_teks: string;
  kategori: string | null;
  tanggal_upload: string;
  is_active: number;
  has_embedding: boolean;
}

const KATEGORI = ['Semua', 'FAQ', 'Produk', 'Pengiriman', 'Kebijakan'];

export default function KnowledgeBasePage() {
  const { addToast } = useToast();
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [stats, setStats] = useState({ total: 0, aktif: 0, withEmbedding: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('Semua');
  const [form, setForm] = useState({ judul: '', teks: '', kategori: 'FAQ' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchData().catch(console.error); }, []);

  async function fetchData() {
    setLoading(true);
    const [entriesData, statsData] = await Promise.all([getAllKnowledgeBase(), getStatsKnowledgeBase()]);
    setEntries(entriesData as KBEntry[]);
    setStats(statsData);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.judul.trim() || !form.teks.trim()) return;
    setSubmitting(true);
    const res = await tambahKnowledgeBase(form.judul, form.teks, form.kategori);
    addToast(res.success ? 'success' : 'error', res.message);
    setForm({ judul: '', teks: '', kategori: 'FAQ' });
    setShowForm(false);
    setSubmitting(false);
    await fetchData();
  }

  async function handleDelete(id: number) {
    if (!confirm('Hapus entri ini?')) return;
    const res = await hapusKnowledgeBase(id);
    addToast(res.success ? 'success' : 'error', res.message);
    await fetchData();
  }

  async function handleToggle(id: number) {
    const res = await toggleActiveKnowledgeBase(id);
    addToast(res.success ? 'success' : 'error', res.message);
    await fetchData();
  }

  const filtered = entries.filter((e) => {
    if (kategoriFilter !== 'Semua' && e.kategori !== kategoriFilter) return false;
    if (search && !e.judul.toLowerCase().includes(search.toLowerCase()) && !e.potongan_teks.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-sm text-headline-sm text-on-surface">AI Knowledge Base</h1>
          <p className="text-on-surface-variant font-body-md mt-1">Upload dokumen untuk meningkatkan kecerdasan chatbot</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setForm({ judul: '', teks: '', kategori: 'FAQ' }); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl font-label-md hover:opacity-90 transition-all shadow-sm">
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? 'Batal' : 'Tambah Dokumen'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-8 bg-surface-container-lowest border border-neutral-200 rounded-xl p-6 flex flex-col md:flex-row items-center gap-6 shadow-sm relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary-fixed opacity-15 rounded-full blur-3xl" />
          <div className="relative z-10 flex-1 space-y-4">
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Latih Otak AI Bot</h3>
              <p className="text-on-surface-variant font-body-md mt-1">Unggah informasi FAQ, deskripsi produk, atau kebijakan bisnis untuk meningkatkan pemahaman cerdas asisten AI Anda.</p>
            </div>
            {!showForm && (
              <button onClick={() => setShowForm(true)}
                className="bg-primary hover:opacity-90 text-on-primary px-5 py-2.5 rounded-lg font-label-md flex items-center gap-2 transition-all shadow-sm">
                <Upload size={18} /> Tambah Dokumen KB
              </button>
            )}
          </div>
          <div className="relative z-10 w-24 h-24 md:w-32 md:h-32 flex items-center justify-center bg-surface-cream rounded-2xl border-2 border-dashed border-primary-container shrink-0">
            <Upload size={36} className="text-primary" />
          </div>
        </div>

        <div className="md:col-span-4 bg-surface-container-lowest border border-neutral-200 rounded-xl p-5 shadow-sm flex flex-col justify-center gap-4">
          <div className="flex items-center gap-3">
            <BookOpen size={20} className="text-primary" />
            <span className="font-label-md text-label-md text-on-surface">Total: <b>{stats.total} Chunks</b></span>
          </div>
          <div className="flex items-center gap-3">
            <Zap size={20} className="text-tertiary" />
            <span className="font-label-md text-label-md text-on-surface">Sudah Dilatih: <span className={`px-2 py-0.5 rounded text-xs font-bold ${stats.withEmbedding === stats.total && stats.total > 0 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {stats.withEmbedding}/{stats.total} ({stats.total > 0 ? Math.round(stats.withEmbedding / stats.total * 100) : 0}%)
            </span></span>
          </div>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-label-md text-on-surface-variant mb-1">Judul *</label>
              <input value={form.judul} onChange={(e) => setForm({ ...form, judul: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary" required />
            </div>
            <div>
              <label className="block text-xs font-label-md text-on-surface-variant mb-1">Kategori</label>
              <select value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary">
                {KATEGORI.filter(k => k !== 'Semua').map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-label-md text-on-surface-variant mb-1">Teks / Konten *</label>
              <textarea value={form.teks} onChange={(e) => setForm({ ...form, teks: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary min-h-[80px] font-body-md" required />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={submitting}
              className="px-5 py-2 bg-primary text-on-primary rounded-lg text-sm font-label-md hover:opacity-90 transition-all shadow-sm disabled:opacity-50">
              {submitting ? 'Memproses...' : 'Upload & Embed'}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari di knowledge base..."
            className="w-full pl-9 pr-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-primary bg-surface" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {KATEGORI.map((k) => (
            <button key={k} onClick={() => setKategoriFilter(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-label-md transition-colors ${kategoriFilter === k ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>
              {k}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-20 bg-surface-container rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">
          <BookOpen size={48} className="mx-auto mb-3 text-outline-variant" />
          <p>{search ? 'Tidak ada hasil' : 'Belum ada data Knowledge Base. Upload dokumen pertama Anda!'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => (
            <div key={entry.id} className={`bg-surface-container-lowest border border-neutral-200 rounded-xl p-4 flex items-start gap-4 hover:shadow-sm transition-all ${!entry.is_active ? 'opacity-60' : ''}`}>
              <div className="w-9 h-9 rounded-lg bg-primary-fixed text-primary flex items-center justify-center shrink-0 mt-0.5">
                <BookOpen size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-label-md text-label-md text-on-surface truncate">{entry.judul}</h3>
                  {entry.kategori && <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                    entry.kategori === 'FAQ' ? 'bg-blue-100 text-blue-700' :
                    entry.kategori === 'Produk' ? 'bg-green-100 text-green-700' :
                    entry.kategori === 'Pengiriman' ? 'bg-orange-100 text-orange-700' :
                    'bg-purple-100 text-purple-700'
                  }`}>{entry.kategori}</span>}
                  {!entry.has_embedding && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-700 shrink-0">NO VECTOR</span>}
                </div>
                <p className="text-sm text-on-surface-variant line-clamp-2">{entry.potongan_teks}</p>
                <p className="text-xs text-on-surface-variant mt-1">{new Date(entry.tanggal_upload).toLocaleDateString('id-ID')}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => handleToggle(entry.id)} className={`p-1.5 rounded-lg hover:bg-surface-container ${entry.is_active ? 'text-green-600' : 'text-on-surface-variant'}`}
                  title={entry.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                  {entry.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                </button>
                <button onClick={() => handleDelete(entry.id)} className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-error">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
