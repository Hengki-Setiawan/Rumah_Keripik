'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Package, Search, TrendingUp, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { getAllProduk, tambahProduk, updateHarga, nonaktifkanProduk, aktifkanProduk } from '@/actions/produk';
import type { Produk } from '@/lib/schema';
import { useToast } from '@/components/ui/toast';
import { ConfirmModal } from '@/components/ui/modal';
import { CardSkeleton } from '@/components/ui/skeleton';
import { ExportButton } from '@/components/ui/export-button';
import { exportProdukCSV } from '@/actions/export';

function formatRupiahDesign(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export default function ProdukPage() {
  const { addToast } = useToast();
  const [products, setProducts] = useState<Produk[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Semua');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string; active: boolean } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [formData, setFormData] = useState({
    nama_produk: '',
    deskripsi: '',
    harga_jual: 0,
    stok_gudang_utama: 0,
  });

  useEffect(() => {
    loadProducts().catch(console.error);
  }, []);

  async function loadProducts() {
    setLoading(true);
    const data = await getAllProduk();
    setProducts(data);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      const result = await updateHarga(editingId, formData.harga_jual);
      addToast(result.success ? 'success' : 'error', result.message);
    } else {
      const result = await tambahProduk({
        nama_produk: formData.nama_produk,
        deskripsi: formData.deskripsi,
        harga_jual: formData.harga_jual,
        stok_gudang_utama: formData.stok_gudang_utama,
      });
      addToast(result.success ? 'success' : 'error', result.message);
    }
    setFormData({ nama_produk: '', deskripsi: '', harga_jual: 0, stok_gudang_utama: 0 });
    setEditingId(null);
    setShowForm(false);
    await loadProducts();
  }

  function openConfirm(id: string, name: string, active: boolean) {
    setConfirmTarget({ id, name, active });
    setConfirmOpen(true);
  }

  async function handleConfirmToggle() {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    const result = confirmTarget.active
      ? await nonaktifkanProduk(confirmTarget.id)
      : await aktifkanProduk(confirmTarget.id);
    addToast(result.success ? 'success' : 'error', result.message);
    setConfirmOpen(false);
    setConfirmTarget(null);
    setConfirmLoading(false);
    await loadProducts();
  }

  const categories = ['Semua', ...new Set(products.map((p) => {
    const name = p.nama_produk.toLowerCase();
    if (name.includes('singkong')) return 'Kripik Singkong';
    if (name.includes('pisang')) return 'Kripik Pisang';
    if (name.includes('tempe')) return 'Kripik Tempe';
    return 'Lainnya';
  }))];

  const filtered = products.filter((p) => {
    if (categoryFilter !== 'Semua') {
      const name = p.nama_produk.toLowerCase();
      const cat = categoryFilter.toLowerCase();
      if (cat.includes('singkong') && !name.includes('singkong')) return false;
      if (cat.includes('pisang') && !name.includes('pisang')) return false;
      if (cat.includes('tempe') && !name.includes('tempe')) return false;
    }
    return (
      p.nama_produk.toLowerCase().includes(search.toLowerCase()) ||
      p.id_produk.toLowerCase().includes(search.toLowerCase())
    );
  });

  const productGradients = [
    'from-amber-200 to-orange-300',
    'from-yellow-200 to-amber-300',
    'from-green-200 to-emerald-300',
    'from-rose-200 to-pink-300',
    'from-purple-200 to-violet-300',
    'from-sky-200 to-blue-300',
    'from-teal-200 to-cyan-300',
    'from-red-200 to-rose-300',
  ];

  if (loading) {
    return (
      <div>
        <div className="flex flex-col md:flex-row gap-4 mb-stack-lg items-center justify-between">
          <div className="w-full md:w-96">
            <div className="animate-pulse h-10 bg-surface-container-high rounded-xl" />
          </div>
          <div className="flex gap-2">
            {[1,2,3,4].map((i) => (
              <div key={i} className="animate-pulse h-8 w-24 bg-surface-container-high rounded-full" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
          {[1,2,3].map((i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row gap-4 mb-stack-lg items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Cari nama produk atau kode (KRP-001)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-xl focus:ring-primary focus:border-primary font-body-md text-body-md transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <ExportButton action={exportProdukCSV} label="Export" />
        </div>
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-4 py-2 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors ${
                categoryFilter === cat
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-outline-variant'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
        {filtered.map((product, idx) => {
          const isLowStock = product.stok_gudang_utama > 0 && product.stok_gudang_utama <= 10;
          const isOutStock = product.stok_gudang_utama === 0;
          const isBestSeller = idx === 0 && product.is_active;
          const gradient = productGradients[idx % productGradients.length];
          return (
            <div
              key={product.id_produk}
              className={`group bg-surface-container-lowest border border-neutral-200 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col ${
                !product.is_active ? 'opacity-60 grayscale-[0.5]' : ''
              }`}
            >
              <div className={`relative h-48 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                <Package size={72} className="text-white/40" />
                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-primary font-mono text-[11px] font-bold shadow-sm">
                  {product.id_produk}
                </div>
                {isBestSeller && (
                  <div className="absolute top-3 right-3 bg-secondary px-2 py-1 rounded text-white font-label-md text-[10px] uppercase tracking-wider">
                    Best Seller
                  </div>
                )}
                {!product.is_active && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="bg-white text-on-surface font-label-md px-3 py-1 rounded-full border border-neutral-200">
                      Nonaktif
                    </span>
                  </div>
                )}
              </div>

              <div className="p-stack-md flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">{product.nama_produk}</h3>
                  <div className="text-right">
                    <p className="font-headline-sm text-headline-sm text-primary">
                      {formatRupiahDesign(product.harga_jual)}
                    </p>
                    <p className="font-caption text-caption text-on-surface-variant italic">per bungkus</p>
                  </div>
                </div>

                {product.deskripsi && (
                  <p className="font-caption text-caption text-on-surface-variant mb-2 line-clamp-1">{product.deskripsi}</p>
                )}

                <div className="flex items-center gap-2 mb-stack-md">
                  <Package size={16} className="text-secondary" />
                  <span className="font-body-md text-body-md">
                    Stok: <span className={`font-bold ${isOutStock ? 'text-error' : isLowStock ? 'text-error' : 'text-on-surface'}`}>
                      {product.stok_gudang_utama} pcs
                    </span>
                  </span>
                  {isLowStock && (
                    <span className="ml-auto flex items-center text-[10px] text-error font-bold bg-error-container px-1.5 py-0.5 rounded">
                      <AlertCircle size={12} className="mr-1" /> Low
                    </span>
                  )}
                  {!isLowStock && !isOutStock && product.stok_gudang_utama > 0 && (
                    <span className="ml-auto flex items-center text-[10px] text-neutral-500 font-bold bg-surface-container-high px-1.5 py-0.5 rounded">
                      <TrendingUp size={12} className="mr-1" /> Stable
                    </span>
                  )}
                </div>

                <div className="mt-auto grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setEditingId(product.id_produk);
                      setFormData({
                        nama_produk: product.nama_produk,
                        deskripsi: product.deskripsi || '',
                        harga_jual: product.harga_jual,
                        stok_gudang_utama: product.stok_gudang_utama,
                      });
                      setShowForm(true);
                    }}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-outline-variant text-on-surface-variant font-label-md hover:bg-surface-container-high transition-colors"
                  >
                    <Edit2 size={16} /> Edit
                  </button>
                  <button
                    onClick={() => openConfirm(product.id_produk, product.nama_produk, !!product.is_active)}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-label-md transition-all ${
                      product.is_active
                        ? 'border border-error/20 text-error hover:bg-error-container'
                        : 'bg-primary text-on-primary hover:opacity-90'
                    }`}
                  >
                    {product.is_active ? <><EyeOff size={16} /> Nonaktifkan</> : <><Eye size={16} /> Aktifkan</>}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setFormData({ nama_produk: '', deskripsi: '', harga_jual: 0, stok_gudang_utama: 0 });
          }}
          className="group bg-transparent border-2 border-dashed border-outline-variant rounded-xl overflow-hidden hover:border-primary hover:bg-primary/5 transition-all duration-300 min-h-[350px] flex items-center justify-center cursor-pointer"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-primary-container transition-transform group-hover:scale-110">
              <Plus size={32} />
            </div>
            <span className="font-headline-sm text-on-surface-variant group-hover:text-primary">Tambah Produk Baru</span>
            <p className="font-body-md text-on-surface-variant/60 text-center px-8">Masukkan data kripik terbaru ke dalam inventori</p>
          </div>
        </button>
      </div>

      <button
        onClick={() => {
          setShowForm(true);
          setEditingId(null);
          setFormData({ nama_produk: '', deskripsi: '', harga_jual: 0, stok_gudang_utama: 0 });
        }}
        className="fixed bottom-20 right-6 lg:hidden w-14 h-14 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform z-50"
      >
        <Plus size={28} />
      </button>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-outline-variant/20">
              <h2 className="font-headline-md text-headline-md text-on-surface">
                {editingId ? 'Edit Produk' : 'Tambah Produk Baru'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1">Nama Produk *</label>
                <input
                  required
                  value={formData.nama_produk}
                  onChange={(e) => setFormData({ ...formData, nama_produk: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-primary focus:border-primary font-body-md"
                  placeholder="Contoh: Kripik Original"
                  disabled={!!editingId}
                />
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1">Deskripsi</label>
                <input
                  value={formData.deskripsi}
                  onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-primary focus:border-primary font-body-md"
                  placeholder="Deskripsi singkat produk"
                  disabled={!!editingId}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-md text-label-md text-on-surface mb-1">Harga Jual (Rp) *</label>
                  <input
                    type="number"
                    value={formData.harga_jual}
                    onChange={(e) => setFormData({ ...formData, harga_jual: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-primary focus:border-primary font-body-md"
                    placeholder="15000"
                  />
                </div>
                <div>
                  <label className="block font-label-md text-label-md text-on-surface mb-1">Stok Awal</label>
                  <input
                    type="number"
                    value={formData.stok_gudang_utama}
                    onChange={(e) => setFormData({ ...formData, stok_gudang_utama: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-primary focus:border-primary font-body-md"
                    placeholder="100"
                    disabled={!!editingId}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-primary text-on-primary py-2.5 rounded-lg font-label-md hover:opacity-90 transition-opacity">
                  {editingId ? 'Simpan Perubahan' : 'Tambah Produk'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 border border-outline-variant rounded-lg text-on-surface-variant font-label-md hover:bg-surface-container-high transition-colors">
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); setConfirmTarget(null); }}
        onConfirm={handleConfirmToggle}
        title={confirmTarget?.active ? 'Nonaktifkan Produk' : 'Aktifkan Produk'}
        message={`Apakah Anda yakin ingin ${confirmTarget?.active ? 'menonaktifkan' : 'mengaktifkan'} "${confirmTarget?.name}"?`}
        confirmLabel={confirmTarget?.active ? 'Nonaktifkan' : 'Aktifkan'}
        variant={confirmTarget?.active ? 'danger' : 'primary'}
        loading={confirmLoading}
      />

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12">
          <Package size={48} className="mx-auto mb-3 text-outline-variant" />
          <p className="font-body-md text-on-surface-variant">
            {search ? 'Produk tidak ditemukan' : 'Belum ada produk. Tambahkan produk pertama Anda!'}
          </p>
        </div>
      )}
    </div>
  );
}
