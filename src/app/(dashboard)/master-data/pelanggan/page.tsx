'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAllPelanggan, updatePelanggan, getStatsPelanggan } from '@/actions/pelanggan';
import { Users, Search, Edit2, X, Phone, Bot, UserCog, ArrowRight, Tag } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { KpiCardSkeleton } from '@/components/ui/skeleton';
import { ExportButton } from '@/components/ui/export-button';
import { exportPelangganCSV } from '@/actions/export';

interface Pelanggan {
  no_wa_pelanggan: string;
  nama_pelanggan: string | null;
  alamat_pengiriman: string | null;
  status_handle: string;
  tags: string | null;
  waktu_daftar: string;
  terakhir_aktif: string;
}

export default function PelangganPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [pelanggan, setPelanggan] = useState<Pelanggan[]>([]);
  const [stats, setStats] = useState({ total: 0, aiBot: 0, manual: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editModal, setEditModal] = useState<Pelanggan | null>(null);
  const [editForm, setEditForm] = useState({ nama_pelanggan: '', alamat_pengiriman: '' });

  useEffect(() => { fetchData().catch(console.error); }, []);

  async function fetchData() {
    setLoading(true);
    const [data, stat] = await Promise.all([
      getAllPelanggan(),
      getStatsPelanggan(),
    ]);
    setPelanggan(data);
    setStats(stat);
    setLoading(false);
  }

  function openEdit(p: Pelanggan) {
    setEditModal(p);
    setEditForm({ nama_pelanggan: p.nama_pelanggan || '', alamat_pengiriman: p.alamat_pengiriman || '' });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editModal) return;

    const res = await updatePelanggan(editModal.no_wa_pelanggan, {
      nama_pelanggan: editForm.nama_pelanggan,
      alamat_pengiriman: editForm.alamat_pengiriman,
    });

    addToast(res.success ? 'success' : 'error', res.message);
    if (res.success) {
      setEditModal(null);
      fetchData();
    }
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

  const filtered = pelanggan.filter((p) =>
    p.nama_pelanggan?.toLowerCase().includes(search.toLowerCase()) ||
    p.no_wa_pelanggan.includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Data Pelanggan</h1>
          <p className="text-on-surface-variant font-body-md mt-1">Kelola data pelanggan chatbot dan lihat riwayat interaksi</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        {[
          { label: 'Total Pelanggan', value: stats.total.toString(), icon: Users, color: 'text-primary', bg: 'bg-primary-fixed' },
          { label: 'AI Bot', value: stats.aiBot.toString(), icon: Bot, color: 'text-green-600', bg: 'bg-green-100' },
          { label: 'Manual Admin', value: stats.manual.toString(), icon: UserCog, color: 'text-secondary', bg: 'bg-secondary-fixed' },
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
            placeholder="Cari pelanggan (nama/no. WA)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-primary focus:border-primary font-body-md"
          />
        </div>
        <ExportButton action={exportPelangganCSV} label="Export" />
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setEditModal(null)}>
          <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center">
              <h2 className="font-headline-md text-headline-md text-on-surface">Edit Pelanggan</h2>
              <button onClick={() => setEditModal(null)} className="text-on-surface-variant hover:bg-surface-container rounded-lg p-1 transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              <p className="font-body-md text-on-surface-variant flex items-center gap-1"><Phone size={14} />{editModal.no_wa_pelanggan}</p>
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1">Nama Pelanggan</label>
                <input value={editForm.nama_pelanggan} onChange={(e) => setEditForm({ ...editForm, nama_pelanggan: e.target.value })}
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface-container-lowest focus:ring-primary focus:border-primary font-body-md" />
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1">Alamat Pengiriman</label>
                <textarea value={editForm.alamat_pengiriman} onChange={(e) => setEditForm({ ...editForm, alamat_pengiriman: e.target.value })}
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 bg-surface-container-lowest focus:ring-primary focus:border-primary font-body-md" rows={2} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-primary text-on-primary py-2.5 rounded-lg font-label-md hover:opacity-90 transition-opacity">
                  Simpan
                </button>
                <button type="button" onClick={() => setEditModal(null)} className="px-6 py-2.5 border border-outline-variant rounded-lg text-on-surface-variant font-label-md hover:bg-surface-container-high transition-colors">
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {[1,2,3].map(i => <KpiCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-12 text-center">
          <Users size={48} className="mx-auto mb-3 text-outline-variant" />
          <p className="font-body-md text-on-surface-variant">{search ? 'Pelanggan tidak ditemukan' : 'Belum ada data pelanggan'}</p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-container">
                <tr>
                  <th className="text-left px-4 py-3 font-label-md text-label-md text-on-surface-variant">Pelanggan</th>
                  <th className="text-left px-4 py-3 font-label-md text-label-md text-on-surface-variant">Tags</th>
                  <th className="text-center px-4 py-3 font-label-md text-label-md text-on-surface-variant">Status</th>
                  <th className="text-center px-4 py-3 font-label-md text-label-md text-on-surface-variant">Terakhir Aktif</th>
                  <th className="text-center px-4 py-3 font-label-md text-label-md text-on-surface-variant">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {filtered.map((p) => {
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
                            <p className="font-caption text-caption text-on-surface-variant font-mono">{p.no_wa_pelanggan}</p>
                          </div>
                        </button>
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
                          <button onClick={() => openEdit(p)} className="text-on-surface-variant hover:text-primary p-1 rounded-lg hover:bg-surface-container transition-colors">
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
  );
}
