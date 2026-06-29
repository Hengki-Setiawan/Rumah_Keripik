'use client';

import { useState, useEffect } from 'react';
import { catatPenjualanOffline, getPiutangBelumLunas, tandaiPiutangLunas } from '@/actions/transaksi';
import { getAllProdukAktif } from '@/actions/produk';
import { getAllWarungAktif } from '@/actions/warung';
import { Plus, X, AlertCircle, DollarSign, CheckCircle } from 'lucide-react';

export default function TransaksiOfflinePage() {
  const [produkList, setProdukList] = useState<any[]>([]);
  const [warungList, setWarungList] = useState<any[]>([]);
  const [piutang, setPiutang] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({
    tipePelanggan: 'walk-in' as 'walk-in' | 'wa' | 'warung',
    no_wa_pelanggan: '',
    id_warung: '',
    items: [{ id_produk: '', qty: 1 }] as { id_produk: string; qty: number }[],
    status_pembayaran: 'Lunas' as 'Lunas' | 'Piutang' | 'Tidak_Lunas',
    tanggal_jatuh_tempo: '',
    catatan: '',
  });

  useEffect(() => {
    async function fetchData() {
      const [p, w, piut] = await Promise.all([
        getAllProdukAktif(),
        getAllWarungAktif(),
        getPiutangBelumLunas(),
      ]);
      setProdukList(p);
      setWarungList(w);
      setPiutang(piut);
      setLoading(false);
    }
    fetchData().catch(console.error);
  }, []);

  function formatRupiah(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
  }

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    // Validasi
    const validItems = form.items.filter((i) => i.id_produk && i.qty > 0);
    if (validItems.length === 0) {
      setMessage({ type: 'error', text: 'Minimal 1 item produk' });
      return;
    }

    for (const item of validItems) {
      const p = produkList.find((pr) => pr.id_produk === item.id_produk);
      if (p && p.stok_gudang_utama < item.qty) {
        setMessage({ type: 'error', text: `Stok ${p.nama_produk} tidak cukup (tersedia: ${p.stok_gudang_utama})` });
        return;
      }
    }

    if (form.status_pembayaran === 'Piutang' && !form.tanggal_jatuh_tempo) {
      setMessage({ type: 'error', text: 'Tanggal jatuh tempo wajib diisi untuk piutang' });
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
      setMessage({ type: 'success', text: res.message || 'Transaksi berhasil dicatat' });
      setShowForm(false);
      setForm({
        tipePelanggan: 'walk-in', no_wa_pelanggan: '', id_warung: '',
        items: [{ id_produk: '', qty: 1 }], status_pembayaran: 'Lunas',
        tanggal_jatuh_tempo: '', catatan: '',
      });
      const piut = await getPiutangBelumLunas();
      setPiutang(piut);
    } else {
      setMessage({ type: 'error', text: res.message || 'Gagal mencatat transaksi' });
    }
  }

  async function handleTandaiLunas(id: string) {
    if (!confirm('Tandai piutang ini sebagai LUNAS?')) return;
    const res = await tandaiPiutangLunas(id);
    if (res.success) {
      setMessage({ type: 'success', text: 'Piutang berhasil ditandai lunas' });
      const piut = await getPiutangBelumLunas();
      setPiutang(piut);
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Memuat data...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Transaksi Offline & Piutang</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus size={18} /> Catat Penjualan Offline
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Piutang</p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            {formatRupiah(piutang.reduce((s, p) => s + p.total_bayar, 0))}
          </p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-600">Transaksi Offline</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{piutang.length}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-600">Piutang Belum Lunas</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{piutang.length}</p>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold">Catat Penjualan Offline</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Tipe Pelanggan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pelanggan</label>
                <div className="flex gap-2">
                  {(['walk-in', 'wa', 'warung'] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setForm({ ...form, tipePelanggan: t })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        form.tipePelanggan === t ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}>
                      {t === 'walk-in' ? 'Walk-in' : t === 'wa' ? 'Via WA' : 'Warung'}
                    </button>
                  ))}
                </div>
              </div>

              {form.tipePelanggan === 'wa' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">No. WA Pelanggan</label>
                  <input value={form.no_wa_pelanggan} onChange={(e) => setForm({ ...form, no_wa_pelanggan: e.target.value })}
                    placeholder="6281234567890" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              )}

              {form.tipePelanggan === 'warung' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Warung</label>
                  <select value={form.id_warung} onChange={(e) => setForm({ ...form, id_warung: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500">
                    <option value="">-- Pilih Warung --</option>
                    {warungList.map((w) => (
                      <option key={w.id_warung} value={w.id_warung}>{w.nama_warung} ({w.id_warung})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Items */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-700">Item Produk</label>
                  <button type="button" onClick={addItem} className="text-sm text-orange-600 hover:text-orange-800 font-medium">+ Tambah Item</button>
                </div>
                {form.items.map((item, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <select value={item.id_produk} onChange={(e) => updateItem(i, 'id_produk', e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500">
                      <option value="">-- Pilih Produk --</option>
                      {produkList.map((p) => (
                        <option key={p.id_produk} value={p.id_produk}>
                          {p.nama_produk} - {formatRupiah(p.harga_jual)} (stok: {p.stok_gudang_utama})
                        </option>
                      ))}
                    </select>
                    <input type="number" min="1" value={item.qty} onChange={(e) => updateItem(i, 'qty', parseInt(e.target.value) || 0)}
                      className="w-20 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    <button type="button" onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700">
                      <X size={20} />
                    </button>
                  </div>
                ))}
                <p className="text-sm font-semibold text-gray-700 text-right mt-2">Total: {formatRupiah(getTotal())}</p>
              </div>

              {/* Pembayaran */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status Pembayaran</label>
                  <select value={form.status_pembayaran} onChange={(e) => setForm({ ...form, status_pembayaran: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500">
                    <option value="Lunas">Lunas (Tunai)</option>
                    <option value="Piutang">Piutang (Hutang)</option>
                    <option value="Tidak_Lunas">Belum Bayar</option>
                  </select>
                </div>
                {form.status_pembayaran === 'Piutang' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jatuh Tempo</label>
                    <input type="date" value={form.tanggal_jatuh_tempo} onChange={(e) => setForm({ ...form, tanggal_jatuh_tempo: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan (opsional)</label>
                <textarea value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" rows={2} />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg font-medium">
                  Simpan Transaksi
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Daftar Piutang */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Tagihan Piutang</h3>
        </div>
        {piutang.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <DollarSign size={48} className="mx-auto mb-2 text-gray-300" />
            <p>Tidak ada piutang yang perlu ditagih</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">ID</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Pelanggan/Warung</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Total</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Jatuh Tempo</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {piutang.map((p: any) => (
                <tr key={p.id_transaksi} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">{p.id_transaksi}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{p.nama_pelanggan || p.nama_warung || '-'}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">{formatRupiah(p.total_bayar)}</td>
                  <td className="px-4 py-3 text-sm text-center text-gray-500">
                    {p.tanggal_jatuh_tempo ? new Date(p.tanggal_jatuh_tempo).toLocaleDateString('id-ID') : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleTandaiLunas(p.id_transaksi)}
                      className="flex items-center gap-1 mx-auto text-green-600 hover:text-green-800 text-sm font-medium">
                      <CheckCircle size={16} /> Tandai Lunas
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
