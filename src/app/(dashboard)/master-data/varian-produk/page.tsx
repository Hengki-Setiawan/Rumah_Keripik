'use client';

import { useEffect, useState } from 'react';
import { CloudinaryImageUpload } from '@/components/admin/CloudinaryImageUpload';

type Variant = { id_varian: string; id_produk: string; sku: string | null; nama_varian: string; rasa: string | null; ukuran: string | null; berat_gram: number | null; harga_jual: number; stok: number; image_url: string | null; cloudinary_public_id: string | null; sort_order: number; is_active: number };
type ProductOption = { id_produk: string; nama_produk: string };
const empty = { id_produk: '', sku: '', nama_varian: '', rasa: '', ukuran: '', berat_gram: 0, harga_jual: 0, stok: 0, image_url: '', cloudinary_public_id: '', sort_order: 0, is_active: 1 };

export default function ProductVariantsPage() {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [form, setForm] = useState(empty);
  const [productFilter, setProductFilter] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => { load(); fetch('/api/public/products').then((res) => res.json()).then((data) => setProducts((data.products || []).map((item: any) => ({ id_produk: item.id, nama_produk: item.name })))).catch(() => undefined); }, []);
  async function load() { const res = await fetch('/api/admin/product-variants'); const data = await res.json(); setVariants(data.variants || []); }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch('/api/admin/product-variants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json().catch(() => null);
    setMessage(res.ok && data?.ok ? 'Varian tersimpan' : data?.error || 'Gagal menyimpan varian');
    if (res.ok && data?.ok) { setForm(empty); load(); }
  }
  async function toggle(variant: Variant) { await fetch('/api/admin/product-variants', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: variant.id_varian, data: { is_active: variant.is_active ? 0 : 1 } }) }); load(); }

  return (
    <div className="space-y-6">
      <div><h1 className="font-headline-lg text-headline-lg text-on-surface">Varian Produk</h1><p className="text-on-surface-variant">Kelola rasa, ukuran, harga, dan stok varian untuk /pesan.</p></div>
      <input value={productFilter} onChange={(e) => setProductFilter(e.target.value)} placeholder="Filter ID produk, contoh KRP-001" className="w-full rounded-xl border bg-white px-3 py-2 md:max-w-sm" />
      <form onSubmit={submit} className="grid gap-3 rounded-2xl border bg-white p-5 shadow-sm md:grid-cols-3">
        <select value={form.id_produk} onChange={(e) => setForm({ ...form, id_produk: e.target.value })} className="rounded-xl border px-3 py-2" required>
          <option value="">Pilih produk</option>
          {products.map((product) => <option key={product.id_produk} value={product.id_produk}>{product.id_produk} - {product.nama_produk}</option>)}
        </select>
        <input value={form.nama_varian} onChange={(e) => setForm({ ...form, nama_varian: e.target.value })} placeholder="Nama varian" className="rounded-xl border px-3 py-2" required />
        <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="SKU optional" className="rounded-xl border px-3 py-2" />
        <input value={form.rasa} onChange={(e) => setForm({ ...form, rasa: e.target.value })} placeholder="Rasa" className="rounded-xl border px-3 py-2" />
        <input value={form.ukuran} onChange={(e) => setForm({ ...form, ukuran: e.target.value })} placeholder="Ukuran" className="rounded-xl border px-3 py-2" />
        <input type="number" value={form.berat_gram} onChange={(e) => setForm({ ...form, berat_gram: Number(e.target.value) })} placeholder="Berat gram" className="rounded-xl border px-3 py-2" />
        <input type="number" value={form.harga_jual} onChange={(e) => setForm({ ...form, harga_jual: Number(e.target.value) })} placeholder="Harga" className="rounded-xl border px-3 py-2" />
        <input type="number" value={form.stok} onChange={(e) => setForm({ ...form, stok: Number(e.target.value) })} placeholder="Stok" className="rounded-xl border px-3 py-2" />
        <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="Image URL" className="rounded-xl border px-3 py-2" />
        <div className="md:col-span-3">
          <CloudinaryImageUpload folder="rumah-keripik/products/variants" value={form.image_url} onUploaded={(url, publicId) => setForm({ ...form, image_url: url, cloudinary_public_id: publicId })} />
        </div>
        <button className="rounded-xl bg-primary px-4 py-2 font-black text-white md:col-span-3">Simpan Varian</button>
        {message && <p className="text-sm font-bold text-amber-700 md:col-span-3">{message}</p>}
      </form>
      <div className="grid gap-3 md:grid-cols-2">
        {variants.filter((variant) => !productFilter || variant.id_produk.toLowerCase().includes(productFilter.toLowerCase())).map((variant) => <div key={variant.id_varian} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{variant.nama_varian}</p><p className="text-sm text-on-surface-variant">{variant.id_produk} - {variant.sku || '-'}</p><p className="mt-1 text-sm">Rp {variant.harga_jual.toLocaleString('id-ID')} - Stok {variant.stok}</p></div><button onClick={() => toggle(variant)} className={`rounded-full px-3 py-1 text-xs font-black ${variant.is_active ? 'bg-green-100 text-green-800' : 'bg-neutral-100 text-neutral-500'}`}>{variant.is_active ? 'Aktif' : 'Nonaktif'}</button></div></div>)}
      </div>
    </div>
  );
}
