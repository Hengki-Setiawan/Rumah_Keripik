'use client';

import { useEffect, useState } from 'react';

type Category = { id_kategori: string; nama_kategori: string; slug: string; deskripsi: string | null; sort_order: number; is_active: number };

const empty = { nama_kategori: '', slug: '', deskripsi: '', sort_order: 0, is_active: 1 };

export default function ProductCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState('');

  async function load() {
    const res = await fetch('/api/admin/product-categories');
    const data = await res.json();
    setCategories(data.categories || []);
  }
  useEffect(() => { load(); }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch('/api/admin/product-categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json().catch(() => null);
    setMessage(res.ok && data?.ok ? 'Kategori tersimpan' : data?.error || 'Gagal menyimpan kategori');
    if (res.ok && data?.ok) { setForm(empty); load(); }
  }
  async function toggle(category: Category) {
    await fetch('/api/admin/product-categories', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: category.id_kategori, data: { is_active: category.is_active ? 0 : 1 } }) });
    load();
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-semibold tracking-[-0.04em] text-on-surface">Kategori Produk</h1><p className="mt-2 text-sm text-on-surface-variant">Kelola kategori yang muncul di halaman /pesan.</p></div>
      <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-outline-variant bg-white p-5 md:grid-cols-2">
        <input value={form.nama_kategori} onChange={(e) => setForm({ ...form, nama_kategori: e.target.value })} placeholder="Nama kategori" className="rounded-xl border border-outline-variant px-3 py-2 outline-none focus:border-primary/30" required />
        <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="Slug optional" className="rounded-xl border border-outline-variant px-3 py-2 outline-none focus:border-primary/30" />
        <input value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} placeholder="Deskripsi" className="rounded-xl border border-outline-variant px-3 py-2 outline-none focus:border-primary/30" />
        <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} placeholder="Urutan" className="rounded-xl border border-outline-variant px-3 py-2 outline-none focus:border-primary/30" />
        <button className="rounded-xl bg-primary px-4 py-2 font-medium text-white md:col-span-2">Simpan Kategori</button>
        {message && <p className="text-sm text-amber-700 md:col-span-2">{message}</p>}
      </form>
      <div className="grid gap-3 md:grid-cols-2">
        {categories.map((category) => <div key={category.id_kategori} className="rounded-2xl border border-outline-variant bg-white p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{category.nama_kategori}</p><p className="text-sm text-on-surface-variant">{category.slug} - sort {category.sort_order}</p><p className="mt-1 text-sm text-on-surface-variant">{category.deskripsi || '-'}</p></div><button onClick={() => toggle(category)} className={`rounded-full px-3 py-1 text-xs font-medium ${category.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>{category.is_active ? 'Aktif' : 'Nonaktif'}</button></div></div>)}
      </div>
    </div>
  );
}
