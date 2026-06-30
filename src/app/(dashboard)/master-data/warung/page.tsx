'use client';

import { useState, useEffect } from 'react';
import { Store, Plus, Search, Edit2, Eye, EyeOff, Building2, Users } from 'lucide-react';
import { getAllWarung, tambahWarung, updateWarung, nonaktifkanWarung, aktifkanWarung } from '@/actions/warung';
import { useToast } from '@/components/ui/toast';
import { CardSkeleton } from '@/components/ui/skeleton';

interface Warung {
  id_warung: string;
  nama_warung: string;
  pemilik: string | null;
  no_wa_warung: string | null;
  alamat: string;
  tipe_kemitraan: string;
  min_order_grosir: number;
  is_active: number;
  waktu_daftar: string;
}

const TIPE_KEMITRAAN = ['Reseller', 'Agent', 'Dropshipper'] as const;

export default function WarungPage() {
  const { addToast } = useToast();
  const [warungs, setWarungs] = useState<Warung[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    nama_warung: '',
    pemilik: '',
    no_wa_warung: '',
    alamat: '',
    tipe_kemitraan: 'Reseller',
    min_order_grosir: 0,
  });

  useEffect(() => {
    loadData().catch(console.error);
  }, []);

  async function loadData() {
    setLoading(true);
    const data = await getAllWarung();
    setWarungs(data);
    setLoading(false);
  }

  function resetForm() {
    setForm({ nama_warung: '', pemilik: '', no_wa_warung: '', alamat: '', tipe_kemitraan: 'Reseller', min_order_grosir: 0 });
    setEditingId(null);
    setShowForm(false);
  }

  function editWarung(w: Warung) {
    setForm({
      nama_warung: w.nama_warung,
      pemilik: w.pemilik || '',
      no_wa_warung: w.no_wa_warung || '',
      alamat: w.alamat,
      tipe_kemitraan: w.tipe_kemitraan as typeof TIPE_KEMITRAAN[number],
      min_order_grosir: w.min_order_grosir,
    });
    setEditingId(w.id_warung);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      const res = await updateWarung(editingId, form as any);
      addToast(res.success ? 'success' : 'error', res.message);
    } else {
      const res = await tambahWarung(form as any);
      addToast(res.success ? 'success' : 'error', res.message);
    }
    resetForm();
    await loadData();
  }

  async function handleToggle(w: Warung) {
    const res = w.is_active ? await nonaktifkanWarung(w.id_warung) : await aktifkanWarung(w.id_warung);
    addToast(res.success ? 'success' : 'error', res.message);
    await loadData();
  }

  const filtered = warungs.filter((w) =>
    !search || w.nama_warung.toLowerCase().includes(search.toLowerCase()) ||
    (w.pemilik && w.pemilik.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-sm text-headline-sm text-on-surface">Mitra Warung Retail</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            Kelola reseller, agent, dan dropshipper
          </p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl font-label-md hover:opacity-90 transition-all shadow-sm">
          <Plus size={18} /> Tambah Mitra
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-label-md text-on-surface-variant mb-1">Nama Warung *</label>
              <input value={form.nama_warung} onChange={(e) => setForm({ ...form, nama_warung: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary" required />
            </div>
            <div>
              <label className="block text-xs font-label-md text-on-surface-variant mb-1">Pemilik</label>
              <input value={form.pemilik} onChange={(e) => setForm({ ...form, pemilik: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-label-md text-on-surface-variant mb-1">No. WA Warung</label>
              <input value={form.no_wa_warung} onChange={(e) => setForm({ ...form, no_wa_warung: e.target.value })}
                placeholder="62812xxxxx" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-label-md text-on-surface-variant mb-1">Alamat *</label>
              <input value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary" required />
            </div>
            <div>
              <label className="block text-xs font-label-md text-on-surface-variant mb-1">Tipe Kemitraan</label>
              <select value={form.tipe_kemitraan} onChange={(e) => setForm({ ...form, tipe_kemitraan: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary">
                {TIPE_KEMITRAAN.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-label-md text-on-surface-variant mb-1">Min. Order Grosir</label>
              <input type="number" value={form.min_order_grosir} onChange={(e) => setForm({ ...form, min_order_grosir: +e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary" min={0} />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-lg text-sm hover:bg-surface-container">Batal</button>
            <button type="submit" className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-label-md hover:opacity-90">
              {editingId ? 'Update' : 'Simpan'}
            </button>
          </div>
        </form>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama warung atau pemilik..."
          className="w-full pl-9 pr-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-primary bg-surface" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">
          <Store size={48} className="mx-auto mb-3 text-outline-variant" />
          <p>{search ? 'Tidak ada warung yang cocok' : 'Belum ada mitra warung'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((w) => (
            <div key={w.id_warung} className={`bg-surface-container-lowest border rounded-xl p-5 shadow-sm transition-all hover:shadow-md ${!w.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-tertiary-fixed text-tertiary flex items-center justify-center">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="font-label-md text-label-md text-on-surface">{w.nama_warung}</h3>
                    <p className="text-xs text-on-surface-variant">{w.id_warung}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  w.tipe_kemitraan === 'Reseller' ? 'bg-blue-100 text-blue-700' :
                  w.tipe_kemitraan === 'Agent' ? 'bg-purple-100 text-purple-700' :
                  'bg-orange-100 text-orange-700'
                }`}>{w.tipe_kemitraan}</span>
              </div>

              {w.pemilik && <p className="text-sm flex items-center gap-1.5 mb-1"><Users size={14} className="text-on-surface-variant" />{w.pemilik}</p>}
              <p className="text-sm text-on-surface-variant truncate">{w.alamat}</p>
              {w.no_wa_warung && <p className="text-xs text-on-surface-variant mt-1 font-mono">{w.no_wa_warung}</p>}
              <p className="text-xs text-on-surface-variant mt-1">Min grosir: {w.min_order_grosir} pcs</p>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant/20">
                <span className="text-xs text-on-surface-variant">{new Date(w.waktu_daftar).toLocaleDateString('id-ID')}</span>
                <div className="flex gap-1">
                  <button onClick={() => editWarung(w)} className="p-1.5 hover:bg-surface-container rounded-lg text-on-surface-variant hover:text-primary">
                    <Edit2 size={15} />
                  </button>
                  <button onClick={() => handleToggle(w)} className={`p-1.5 hover:bg-surface-container rounded-lg ${w.is_active ? 'text-green-600' : 'text-on-surface-variant'}`}>
                    {w.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
