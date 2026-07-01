'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAllPelanggan, updatePelanggan, getStatsPelanggan } from '@/actions/pelanggan';
import { getAllWarung, tambahWarung, updateWarung, nonaktifkanWarung, aktifkanWarung } from '@/actions/warung';
import { exportPelangganCSV } from '@/actions/export';
import { ExportButton } from '@/components/ui/export-button';
import { useToast } from '@/components/ui/toast';
import { KpiCardSkeleton } from '@/components/ui/skeleton';
import {
  Users,
  Search,
  Edit2,
  X,
  Phone,
  Bot,
  UserCog,
  ArrowRight,
  Tag,
  Store,
  Plus,
  AlertCircle,
  Map,
  MapPin,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import DistributionMap from '@/components/DistributionMap';

interface Pelanggan {
  no_wa_pelanggan: string;
  nama_pelanggan: string | null;
  alamat_pengiriman: string | null;
  channel: 'wa' | 'telegram';
  status_handle: string;
  tags: string | null;
  waktu_daftar: string;
  terakhir_aktif: string;
  latest_lat?: string | null;
  latest_lng?: string | null;
  latest_location_source?: string | null;
}

interface Warung {
  id_warung: string;
  nama_warung: string;
  pemilik: string | null;
  no_wa_warung: string | null;
  alamat: string;
  tipe_kemitraan: string;
  min_order_grosir: number;
  is_active: number;
}

export default function MasterDataPelangganPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'pelanggan' | 'warung' | 'map'>('pelanggan');

  // Pelanggan States
  const [pelanggan, setPelanggan] = useState<Pelanggan[]>([]);
  const [pelangganStats, setPelangganStats] = useState({ total: 0, aiBot: 0, manual: 0 });
  const [pelangganLoading, setPelangganLoading] = useState(true);
  const [pelangganSearch, setPelangganSearch] = useState('');
  const [editPelangganModal, setEditPelangganModal] = useState<Pelanggan | null>(null);
  const [editPelangganForm, setEditPelangganForm] = useState({ nama_pelanggan: '', alamat_pengiriman: '' });

  // Warung States
  const [warungList, setWarungList] = useState<Warung[]>([]);
  const [warungLoading, setWarungLoading] = useState(true);
  const [warungSearch, setWarungSearch] = useState('');
  const [showWarungForm, setShowWarungForm] = useState(false);
  const [editWarungData, setEditWarungData] = useState<Warung | null>(null);
  const [warungForm, setWarungForm] = useState<{
    nama_warung: string;
    pemilik: string;
    no_wa_warung: string;
    alamat: string;
    tipe_kemitraan: 'Reseller' | 'Agent' | 'Dropshipper';
    min_order_grosir: number;
  }>({
    nama_warung: '',
    pemilik: '',
    no_wa_warung: '',
    alamat: '',
    tipe_kemitraan: 'Reseller',
    min_order_grosir: 0,
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchPelangganData().catch(console.error);
    fetchWarungData().catch(console.error);
  }, []);

  useEffect(() => {
    const nextTab = searchParams.get('tab');
    if (nextTab === 'pelanggan' || nextTab === 'warung' || nextTab === 'map') {
      setActiveTab(nextTab);
    }
  }, [searchParams]);

  // Fetch functions
  async function fetchPelangganData() {
    setPelangganLoading(true);
    const [data, stat] = await Promise.all([
      getAllPelanggan(),
      getStatsPelanggan(),
    ]);
    setPelanggan(data as any);
    setPelangganStats(stat);
    setPelangganLoading(false);
  }

  async function fetchWarungData() {
    setWarungLoading(true);
    const data = await getAllWarung();
    setWarungList(data);
    setWarungLoading(false);
  }

  // Pelanggan Actions
  function openEditPelanggan(p: Pelanggan) {
    setEditPelangganModal(p);
    setEditPelangganForm({
      nama_pelanggan: p.nama_pelanggan || '',
      alamat_pengiriman: p.alamat_pengiriman || '',
    });
  }

  async function handleEditPelangganSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editPelangganModal) return;

    const res = await updatePelanggan(editPelangganModal.no_wa_pelanggan, {
      nama_pelanggan: editPelangganForm.nama_pelanggan,
      alamat_pengiriman: editPelangganForm.alamat_pengiriman,
    });

    addToast(res.success ? 'success' : 'error', res.message);
    if (res.success) {
      setEditPelangganModal(null);
      fetchPelangganData();
    }
  }

  // Warung Actions
  function resetWarungForm() {
    setWarungForm({
      nama_warung: '',
      pemilik: '',
      no_wa_warung: '',
      alamat: '',
      tipe_kemitraan: 'Reseller',
      min_order_grosir: 0,
    });
    setEditWarungData(null);
    setShowWarungForm(false);
  }

  function openEditWarung(w: Warung) {
    setEditWarungData(w);
    setFormFromWarung(w);
    setShowWarungForm(true);
  }

  function setFormFromWarung(w: Warung) {
    setWarungForm({
      nama_warung: w.nama_warung,
      pemilik: w.pemilik || '',
      no_wa_warung: w.no_wa_warung || '',
      alamat: w.alamat,
      tipe_kemitraan: w.tipe_kemitraan as 'Reseller' | 'Agent' | 'Dropshipper',
      min_order_grosir: w.min_order_grosir,
    });
  }

  async function handleWarungSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (editWarungData) {
      const res = await updateWarung(editWarungData.id_warung, warungForm);
      if (res.success) {
        addToast('success', res.message);
        resetWarungForm();
        fetchWarungData();
      } else {
        setMessage({ type: 'error', text: res.message });
      }
    } else {
      const res = await tambahWarung(warungForm);
      if (res.success) {
        addToast('success', res.message);
        resetWarungForm();
        fetchWarungData();
      } else {
        setMessage({ type: 'error', text: res.message });
      }
    }
  }

  async function handleToggleWarungActive(w: Warung) {
    const res = w.is_active ? await nonaktifkanWarung(w.id_warung) : await aktifkanWarung(w.id_warung);
    if (res.success) {
      addToast('success', res.message);
      fetchWarungData();
    } else {
      addToast('error', 'Gagal mengubah status warung');
    }
  }

  // Helpers
  function formatRupiahLocal(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
  }

  function formatDate(ts: string) {
    const d = new Date(ts + 'Z');
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Hari ini';
    if (days === 1) return 'Kemarin';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Filters
  const filteredPelanggan = pelanggan.filter((p) =>
    p.nama_pelanggan?.toLowerCase().includes(pelangganSearch.toLowerCase()) ||
    p.no_wa_pelanggan.includes(pelangganSearch)
  );

  const filteredWarung = warungList.filter((w) =>
    w.nama_warung.toLowerCase().includes(warungSearch.toLowerCase()) ||
    w.pemilik?.toLowerCase().includes(warungSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Data Pelanggan & Mitra</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            Kelola pelanggan chatbot, warung retail mitra, dan rute logistik distribusi pengiriman
          </p>
        </div>
        {activeTab === 'warung' && (
          <button
            onClick={() => { resetWarungForm(); setShowWarungForm(true); }}
            className="bg-primary hover:opacity-90 text-on-primary px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-label-md transition-all shrink-0 shadow-sm"
          >
            <Plus size={18} /> Tambah Warung
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-container-lowest border border-neutral-200 rounded-xl p-1 w-full md:w-fit">
        {[
          { key: 'pelanggan' as const, label: 'Pelanggan Chatbot', icon: Users, count: pelanggan.length },
          { key: 'warung' as const, label: 'Warung Retail', icon: Store, count: warungList.length },
          { key: 'map' as const, label: 'Peta Distribusi', icon: Map },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => { setActiveTab(t.key); setMessage(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-label-md text-label-md transition-all flex-1 md:flex-initial justify-center whitespace-nowrap ${
                isActive
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container'
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

      {message && (
        <div className={`p-4 rounded-xl flex items-start gap-3 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
          <p className="font-body-md flex-1">{message.text}</p>
          <button onClick={() => setMessage(null)} className="text-on-surface-variant hover:text-on-surface">
            <X size={16} />
          </button>
        </div>
      )}

      {/* --- TAB 1: PELANGGAN --- */}
      {activeTab === 'pelanggan' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            {[
              { label: 'Total Pelanggan', value: pelangganStats.total.toString(), icon: Users, color: 'text-primary', bg: 'bg-primary-fixed' },
              { label: 'AI Bot Aktif', value: pelangganStats.aiBot.toString(), icon: Bot, color: 'text-green-600', bg: 'bg-green-100' },
              { label: 'Penanganan Manual', value: pelangganStats.manual.toString(), icon: UserCog, color: 'text-secondary', bg: 'bg-secondary-fixed' },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-stack-md">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-label-md text-label-md text-on-surface-variant">{s.label}</p>
                    <div className={`${s.bg} ${s.color} p-2.5 rounded-lg`}><Icon size={20} /></div>
                  </div>
                  <p className="font-headline-md text-headline-md font-bold text-on-surface">{s.value}</p>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 md:max-w-96">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Cari pelanggan..."
                value={pelangganSearch}
                onChange={(e) => setPelangganSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-body-md"
              />
            </div>
            <ExportButton action={exportPelangganCSV} label="Export CSV" />
          </div>

          {/* Edit Pelanggan Modal */}
          {editPelangganModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditPelangganModal(null)}>
              <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center">
                  <h2 className="font-headline-md text-headline-md text-on-surface">Edit Alamat Pelanggan</h2>
                  <button onClick={() => setEditPelangganModal(null)} className="text-on-surface-variant hover:bg-surface-container rounded-lg p-1 transition-colors"><X size={20} /></button>
                </div>
                <form onSubmit={handleEditPelangganSubmit} className="p-6 space-y-4">
                  <p className="font-body-md text-on-surface-variant flex items-center gap-1.5 font-mono"><Phone size={14} />{editPelangganModal.no_wa_pelanggan}</p>
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface mb-1">Nama Pelanggan</label>
                    <input value={editPelangganForm.nama_pelanggan} onChange={(e) => setEditPelangganForm({ ...editPelangganForm, nama_pelanggan: e.target.value })}
                      className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface-container-lowest focus:ring-primary focus:border-primary font-body-md focus:outline-none" />
                  </div>
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface mb-1">Alamat Pengiriman</label>
                    <textarea value={editPelangganForm.alamat_pengiriman} onChange={(e) => setEditPelangganForm({ ...editPelangganForm, alamat_pengiriman: e.target.value })}
                      className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface-container-lowest focus:ring-primary focus:border-primary font-body-md focus:outline-none" rows={3} />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="submit" className="flex-1 bg-primary text-on-primary py-2.5 rounded-lg font-label-md hover:opacity-90 transition-opacity">
                      Simpan
                    </button>
                    <button type="button" onClick={() => setEditPelangganModal(null)} className="px-6 py-2.5 border border-outline-variant rounded-lg text-on-surface-variant font-label-md hover:bg-surface-container-high transition-colors">
                      Batal
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Table */}
          {pelangganLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter animate-pulse">
              {[1, 2, 3].map(i => <div key={i} className="h-32 bg-surface-container rounded-xl" />)}
            </div>
          ) : filteredPelanggan.length === 0 ? (
            <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-12 text-center">
              <Users size={48} className="mx-auto mb-3 text-outline-variant" />
              <p className="font-body-md text-on-surface-variant">{pelangganSearch ? 'Pelanggan tidak ditemukan' : 'Belum ada data pelanggan'}</p>
            </div>
          ) : (
            <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-container">
                    <tr>
                      <th className="text-left px-4 py-3 font-label-md text-label-md text-on-surface-variant">Pelanggan</th>
                      <th className="text-left px-4 py-3 font-label-md text-label-md text-on-surface-variant">Alamat Pengiriman</th>
                      <th className="text-left px-4 py-3 font-label-md text-label-md text-on-surface-variant">Tags</th>
                      <th className="text-center px-4 py-3 font-label-md text-label-md text-on-surface-variant">Status</th>
                      <th className="text-center px-4 py-3 font-label-md text-label-md text-on-surface-variant">Terakhir Aktif</th>
                      <th className="text-center px-4 py-3 font-label-md text-label-md text-on-surface-variant">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {filteredPelanggan.map((p) => {
                      const tags = JSON.parse(p.tags || '[]');
                      return (
                        <tr key={p.no_wa_pelanggan} className="hover:bg-surface-cream transition-colors">
                          <td className="px-4 py-3">
                            <button
                              onClick={() => router.push(`/master-data/pelanggan/${encodeURIComponent(p.no_wa_pelanggan)}`)}
                              className="flex items-center gap-3 text-left group"
                            >
                              <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold text-sm shrink-0">
                                {(p.nama_pelanggan || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-label-md text-on-surface group-hover:text-primary transition-colors">{p.nama_pelanggan || 'Tanpa Nama'}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="font-caption text-caption text-on-surface-variant font-mono">{p.no_wa_pelanggan}</span>
                                  <span className={`inline-flex items-center text-[9px] px-1 rounded font-bold uppercase ${p.channel === 'telegram' ? 'bg-sky-50 text-sky-600 border border-sky-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
                                    {p.channel === 'telegram' ? 'TG' : 'WA'}
                                  </span>
                                </div>
                              </div>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-on-surface-variant font-body-md text-sm max-w-xs truncate">
                            {p.alamat_pengiriman || <span className="text-outline/40 italic">Belum disetting</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {tags.length === 0 ? (
                                <span className="text-on-surface-variant/50 text-[11px]">-</span>
                              ) : tags.slice(0, 2).map((tag: string) => (
                                <span key={tag} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px]">
                                  <Tag size={10} /> {tag}
                                </span>
                              ))}
                              {tags.length > 2 && (
                                <span className="text-[10px] text-on-surface-variant">+{tags.length - 2}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2.5 py-1 rounded-full font-label-md text-[10px] ${
                              p.status_handle === 'AI_Bot' ? 'bg-green-100 text-green-700' : 'bg-secondary-fixed text-secondary'
                            }`}>
                              {p.status_handle === 'AI_Bot' ? 'AI Bot' : 'Manual'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-on-surface-variant font-body-md text-sm">{formatDate(p.terakhir_aktif)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => router.push(`/master-data/pelanggan/${encodeURIComponent(p.no_wa_pelanggan)}`)}
                                className="flex items-center gap-1 text-primary font-label-md hover:underline text-sm"
                              >
                                Detail <ArrowRight size={14} />
                              </button>
                              <button onClick={() => openEditPelanggan(p)} className="text-on-surface-variant hover:text-primary p-1.5 rounded-lg hover:bg-surface-container transition-colors">
                                <Edit2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 2: WARUNG RETAIL --- */}
      {activeTab === 'warung' && (
        <div className="space-y-6">
          <div className="relative max-w-96">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Cari warung..."
              value={warungSearch}
              onChange={(e) => setWarungSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-body-md"
            />
          </div>

          {/* Warung Form Modal */}
          {showWarungForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={resetWarungForm}>
              <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center">
                  <h2 className="font-headline-md text-headline-md text-on-surface">{editWarungData ? 'Edit Mitra Warung' : 'Tambah Mitra Warung'}</h2>
                  <button onClick={resetWarungForm} className="text-on-surface-variant hover:bg-surface-container rounded-lg p-1 transition-colors"><X size={20} /></button>
                </div>
                <form onSubmit={handleWarungSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface mb-1">Nama Warung *</label>
                    <input required value={warungForm.nama_warung} onChange={(e) => setWarungForm({ ...warungForm, nama_warung: e.target.value })}
                      className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface-container-lowest focus:ring-primary focus:border-primary font-body-md focus:outline-none" />
                  </div>
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface mb-1">Pemilik</label>
                    <input value={warungForm.pemilik} onChange={(e) => setFormFromField('pemilik', e.target.value)}
                      className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface-container-lowest focus:ring-primary focus:border-primary font-body-md focus:outline-none" />
                  </div>
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface mb-1">No. WA Warung</label>
                    <input value={warungForm.no_wa_warung} onChange={(e) => setFormFromField('no_wa_warung', e.target.value)}
                      className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface-container-lowest focus:ring-primary focus:border-primary font-body-md focus:outline-none" />
                  </div>
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface mb-1">Alamat Warung *</label>
                    <textarea required value={warungForm.alamat} onChange={(e) => setWarungForm({ ...warungForm, alamat: e.target.value })}
                      className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface-container-lowest focus:ring-primary focus:border-primary font-body-md focus:outline-none" rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-label-md text-label-md text-on-surface mb-1 font-semibold">Kemitraan</label>
                      <select value={warungForm.tipe_kemitraan} onChange={(e) => setWarungForm({ ...warungForm, tipe_kemitraan: e.target.value as any })}
                        className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface-container-lowest focus:ring-primary focus:border-primary font-body-md focus:outline-none">
                        <option value="Reseller">Reseller</option>
                        <option value="Agent">Agent</option>
                        <option value="Dropshipper">Dropshipper</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-label-md text-label-md text-on-surface mb-1">Min. Order Grosir</label>
                      <input type="number" min="0" value={warungForm.min_order_grosir} onChange={(e) => setWarungForm({ ...warungForm, min_order_grosir: parseInt(e.target.value) || 0 })}
                        className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface-container-lowest focus:ring-primary focus:border-primary font-body-md focus:outline-none" />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="submit" className="flex-1 bg-primary text-on-primary py-2.5 rounded-lg font-label-md hover:opacity-90 transition-opacity">
                      {editWarungData ? 'Simpan Perubahan' : 'Daftarkan Warung'}
                    </button>
                    <button type="button" onClick={resetWarungForm} className="px-4 py-2.5 border border-outline-variant rounded-lg text-on-surface-variant font-label-md hover:bg-surface-container-high transition-colors">
                      Batal
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Table */}
          {warungLoading ? (
            <div className="text-center py-12 text-on-surface-variant font-body-md">Memuat data...</div>
          ) : filteredWarung.length === 0 ? (
            <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-12 text-center shadow-sm">
              <Store size={48} className="mx-auto mb-3 text-outline-variant" />
              <p className="font-body-md text-on-surface-variant">{warungSearch ? 'Mitra warung tidak ditemukan' : 'Belum ada warung retail terdaftar'}</p>
            </div>
          ) : (
            <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full">
                <thead className="bg-surface-container">
                  <tr>
                    <th className="text-left px-4 py-3 font-label-md text-label-md text-on-surface-variant">ID Warung</th>
                    <th className="text-left px-4 py-3 font-label-md text-label-md text-on-surface-variant">Nama Warung</th>
                    <th className="text-left px-4 py-3 font-label-md text-label-md text-on-surface-variant">Pemilik</th>
                    <th className="text-left px-4 py-3 font-label-md text-label-md text-on-surface-variant">Tipe</th>
                    <th className="text-right px-4 py-3 font-label-md text-label-md text-on-surface-variant">Min. Order</th>
                    <th className="text-center px-4 py-3 font-label-md text-label-md text-on-surface-variant">Status</th>
                    <th className="text-right px-4 py-3 font-label-md text-label-md text-on-surface-variant">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {filteredWarung.map((w) => (
                    <tr key={w.id_warung} className="hover:bg-surface-cream transition-colors font-body-md">
                      <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{w.id_warung}</td>
                      <td className="px-4 py-3 font-semibold text-on-surface">{w.nama_warung}</td>
                      <td className="px-4 py-3 text-on-surface-variant">{w.pemilik || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                          {w.tipe_kemitraan}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{w.min_order_grosir} bks</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          w.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {w.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-3 justify-end">
                          <button onClick={() => openEditWarung(w)} className="text-primary hover:underline font-label-md text-sm">
                            Edit
                          </button>
                          <button onClick={() => handleToggleWarungActive(w)} className={`font-label-md text-sm hover:underline ${w.is_active ? 'text-error' : 'text-green-600'}`}>
                            {w.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 3: MAP DISTRIBUSI --- */}
      {activeTab === 'map' && (
        <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
              <Map className="text-primary" size={22} />
              Peta Sebaran Mitra & Pelanggan
            </h3>
            <p className="text-on-surface-variant font-body-md mt-1">
              Visualisasi sebaran pengiriman pesanan Rumah Kripik di Makassar. Gunakan peta ini untuk menganalisis jarak dan rute logistik tercepat.
            </p>
          </div>
          <DistributionMap customers={pelanggan} warungs={warungList} />
        </div>
      )}
    </div>
  );

  function setFormFromField(field: 'pemilik' | 'no_wa_warung', val: string) {
    setWarungForm(f => ({ ...f, [field]: val }));
  }
}
