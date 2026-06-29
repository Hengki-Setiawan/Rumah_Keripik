'use client';

import { useState, useEffect } from 'react';
import { getAllWarung, tambahWarung, updateWarung, nonaktifkanWarung, aktifkanWarung } from '@/actions/warung';
import { Store, Plus, X, Search, AlertCircle } from 'lucide-react';

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

export default function WarungPage() {
  const [warungList, setWarungList] = useState<Warung[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<Warung | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<{
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

  useEffect(() => { fetchData().catch(console.error); }, []);

  async function fetchData() {
    setLoading(true);
    const data = await getAllWarung();
    setWarungList(data);
    setLoading(false);
  }

  function resetForm() {
    setForm({ nama_warung: '', pemilik: '', no_wa_warung: '', alamat: '', tipe_kemitraan: 'Reseller', min_order_grosir: 0 });
    setEditData(null);
    setShowForm(false);
  }

  function openEdit(w: Warung) {
    setEditData(w);
    setForm({
      nama_warung: w.nama_warung,
      pemilik: w.pemilik || '',
      no_wa_warung: w.no_wa_warung || '',
      alamat: w.alamat,
      tipe_kemitraan: w.tipe_kemitraan as 'Reseller' | 'Agent' | 'Dropshipper',
      min_order_grosir: w.min_order_grosir,
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (editData) {
      const res = await updateWarung(editData.id_warung, form);
      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        resetForm();
        fetchData();
      } else {
        setMessage({ type: 'error', text: res.message });
      }
    } else {
      const res = await tambahWarung(form);
      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        resetForm();
        fetchData();
      } else {
        setMessage({ type: 'error', text: res.message });
      }
    }
  }

  async function handleToggle(w: Warung) {
    const res = w.is_active ? await nonaktifkanWarung(w.id_warung) : await aktifkanWarung(w.id_warung);
    if (res.success) {
      setMessage({ type: 'success', text: res.message });
      fetchData();
    }
  }

  const filtered = warungList.filter((w) =>
    w.nama_warung.toLowerCase().includes(search.toLowerCase()) ||
    w.pemilik?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Warung Retail</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus size={18} /> Tambah Warung
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-start gap-3 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
          <p className="text-sm">{message.text}</p>
          <button onClick={() => setMessage(null)} className="ml-auto"><X size={16} /></button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Cari warung..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold">{editData ? 'Edit Warung' : 'Tambah Warung'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Warung *</label>
                <input required value={form.nama_warung} onChange={(e) => setForm({ ...form, nama_warung: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pemilik</label>
                <input value={form.pemilik} onChange={(e) => setForm({ ...form, pemilik: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. WA Warung</label>
                <input value={form.no_wa_warung} onChange={(e) => setForm({ ...form, no_wa_warung: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alamat *</label>
                <textarea required value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Kemitraan</label>
                  <select value={form.tipe_kemitraan} onChange={(e) => setForm({ ...form, tipe_kemitraan: e.target.value as 'Reseller' | 'Agent' | 'Dropshipper' })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500">
                    <option value="Reseller">Reseller</option>
                    <option value="Agent">Agent</option>
                    <option value="Dropshipper">Dropshipper</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min. Order Grosir</label>
                  <input type="number" min="0" value={form.min_order_grosir} onChange={(e) => setForm({ ...form, min_order_grosir: parseInt(e.target.value) || 0 })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg font-medium">
                  {editData ? 'Simpan Perubahan' : 'Tambah Warung'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Memuat data...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Store size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">{search ? 'Warung tidak ditemukan' : 'Belum ada warung retail'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">ID</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Nama</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Pemilik</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Tipe</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((w) => (
                <tr key={w.id_warung} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">{w.id_warung}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{w.nama_warung}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{w.pemilik || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      {w.tipe_kemitraan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      w.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {w.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(w)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        Edit
                      </button>
                      <button onClick={() => handleToggle(w)} className={`text-sm font-medium ${w.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}>
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
  );
}
