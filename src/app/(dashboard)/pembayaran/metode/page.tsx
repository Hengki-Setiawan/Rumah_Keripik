'use client';

import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Wallet } from 'lucide-react';

type PaymentMethod = {
  id_payment_method: string;
  type: 'bank_transfer' | 'qris' | 'ewallet' | 'cod';
  label: string;
  account_name: string | null;
  account_number: string | null;
  bank_name: string | null;
  qris_image_url: string | null;
  note: string | null;
  sort_order: number;
  is_active: number;
};

const emptyForm = {
  type: 'bank_transfer',
  label: '',
  account_name: '',
  account_number: '',
  bank_name: '',
  qris_image_url: '',
  note: '',
  sort_order: 0,
  is_active: 1,
};

export default function PaymentMethodsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingQris, setUploadingQris] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchMethods().catch(() => setMessage('Gagal memuat metode pembayaran'));
  }, []);

  async function fetchMethods() {
    setLoading(true);
    const res = await fetch('/api/admin/payment-methods');
    const data = await res.json();
    setMethods(data.methods || []);
    setLoading(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    const res = await fetch('/api/admin/payment-methods', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingId ? { id: editingId, data: form } : form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok || !data.ok) {
      setMessage(data.error || 'Gagal menyimpan metode pembayaran');
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setMessage('Metode pembayaran tersimpan');
    fetchMethods();
  }

  async function toggleActive(method: PaymentMethod) {
    await fetch('/api/admin/payment-methods', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: method.id_payment_method, data: { is_active: method.is_active ? 0 : 1 } }),
    });
    fetchMethods();
  }

  async function uploadQris(file: File | null) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('QRIS harus JPG, PNG, atau WEBP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('Ukuran QRIS maksimal 5 MB');
      return;
    }
    setUploadingQris(true);
    setMessage('');
    try {
      const signRes = await fetch('/api/admin/cloudinary/sign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: 'rumah-keripik/qris', publicId: `qris-${Date.now()}` }),
      });
      const sign = await signRes.json();
      if (!signRes.ok || !sign.ok) throw new Error(sign.error || 'Gagal membuat signature QRIS');
      const data = new FormData();
      data.append('file', file);
      data.append('api_key', sign.apiKey);
      data.append('timestamp', String(sign.timestamp));
      data.append('signature', sign.signature);
      data.append('folder', sign.folder);
      if (sign.publicId) data.append('public_id', sign.publicId);
      const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`, { method: 'POST', body: data });
      const cloud = await cloudRes.json();
      if (!cloudRes.ok) throw new Error(cloud.error?.message || 'Upload QRIS gagal');
      setForm((current) => ({ ...current, qris_image_url: cloud.secure_url }));
      setMessage('QRIS berhasil diupload. Simpan metode untuk memakai URL ini.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload QRIS gagal');
    } finally {
      setUploadingQris(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-on-surface">Metode Pembayaran</h1>
          <p className="mt-2 text-sm text-on-surface-variant">Atur transfer bank, QRIS statis, e-wallet, dan COD untuk checkout publik.</p>
        </div>
        <button onClick={() => fetchMethods()} className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2 font-medium hover:bg-surface-container">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-outline-variant bg-white p-5 space-y-4">
        <div className="flex items-center gap-2 font-semibold"><Plus size={18} /> Tambah Metode</div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm font-medium text-on-surface">Tipe
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })} className="w-full rounded-xl border border-outline-variant px-3 py-2">
              <option value="bank_transfer">Transfer Bank</option>
              <option value="qris">QRIS</option>
              <option value="ewallet">E-Wallet</option>
              <option value="cod">COD</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-on-surface">Label
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="w-full rounded-xl border border-outline-variant px-3 py-2 outline-none focus:border-primary/30" placeholder="BCA / QRIS / COD" required />
          </label>
          <label className="space-y-1 text-sm font-medium text-on-surface">Urutan
            <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className="w-full rounded-xl border border-outline-variant px-3 py-2 outline-none focus:border-primary/30" />
          </label>
          <label className="space-y-1 text-sm font-medium text-on-surface">Nama Rekening/Merchant
            <input value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} className="w-full rounded-xl border border-outline-variant px-3 py-2 outline-none focus:border-primary/30" />
          </label>
          <label className="space-y-1 text-sm font-medium text-on-surface">Nomor Rekening/Wallet
            <input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} className="w-full rounded-xl border border-outline-variant px-3 py-2 outline-none focus:border-primary/30" />
          </label>
          <label className="space-y-1 text-sm font-medium text-on-surface">Bank
            <input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} className="w-full rounded-xl border border-outline-variant px-3 py-2 outline-none focus:border-primary/30" />
          </label>
        </div>
        <label className="block space-y-1 text-sm font-medium text-on-surface">URL Gambar QRIS
          <input value={form.qris_image_url} onChange={(e) => setForm({ ...form, qris_image_url: e.target.value })} className="w-full rounded-xl border border-outline-variant px-3 py-2 outline-none focus:border-primary/30" placeholder="https://..." />
        </label>
        <label className="block space-y-1 text-sm font-medium text-on-surface">Upload QRIS ke Cloudinary
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => uploadQris(event.target.files?.[0] || null)} className="w-full rounded-xl border border-outline-variant px-3 py-2" />
          {uploadingQris && <span className="text-xs text-on-surface-variant">Mengupload QRIS...</span>}
        </label>
        {form.qris_image_url && (
          <div className="rounded-xl border border-outline-variant bg-neutral-50 p-3">
            <p className="mb-2 text-sm font-semibold">Preview QRIS</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={form.qris_image_url} alt="Preview QRIS" className="max-h-52 rounded-lg object-contain" />
          </div>
        )}
        <label className="block space-y-1 text-sm font-medium text-on-surface">Catatan Instruksi
          <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full rounded-xl border border-outline-variant px-3 py-2 outline-none focus:border-primary/30" rows={3} />
        </label>
        {message && <p className="text-sm text-amber-700">{message}</p>}
        <div className="flex gap-2">
          <button disabled={saving} className="rounded-xl bg-primary px-5 py-3 font-medium text-white disabled:opacity-60">{saving ? 'Menyimpan...' : editingId ? 'Update Metode' : 'Simpan Metode'}</button>
          {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="rounded-xl border border-outline-variant px-5 py-3 font-medium hover:bg-surface-container">Batal Edit</button>}
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? <p>Memuat...</p> : methods.map((method) => (
          <div key={method.id_payment_method} className="rounded-2xl border border-outline-variant bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 font-semibold"><Wallet size={18} /> {method.label}</div>
                <p className="mt-1 text-sm uppercase text-on-surface-variant">{method.type.replace('_', ' ')}</p>
              </div>
              <button onClick={() => toggleActive(method)} className={`rounded-full px-3 py-1 text-xs font-medium ${method.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>{method.is_active ? 'Aktif' : 'Nonaktif'}</button>
            </div>
            <div className="mt-4 space-y-1 text-sm text-on-surface-variant">
              {method.bank_name && <p>Bank: {method.bank_name}</p>}
              {method.account_number && <p>No: {method.account_number}</p>}
              {method.account_name && <p>Nama: {method.account_name}</p>}
              {method.qris_image_url && <p className="break-all">QRIS: {method.qris_image_url}</p>}
              {method.note && <p>Catatan: {method.note}</p>}
            </div>
            <button onClick={() => { setEditingId(method.id_payment_method); setForm({ type: method.type, label: method.label, account_name: method.account_name || '', account_number: method.account_number || '', bank_name: method.bank_name || '', qris_image_url: method.qris_image_url || '', note: method.note || '', sort_order: method.sort_order, is_active: method.is_active }); }} className="mt-4 rounded-xl border border-outline-variant px-4 py-2 text-sm font-medium hover:bg-surface-container">Edit</button>
          </div>
        ))}
      </div>
    </div>
  );
}
