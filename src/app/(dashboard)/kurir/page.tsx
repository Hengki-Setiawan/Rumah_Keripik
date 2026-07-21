'use client';

import { useState, useEffect } from 'react';
import { Plus, Truck, X, Check, Search, Navigation } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';
import { ConfirmModal } from '@/components/ui/modal';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Courier {
  id: number;
  name: string;
  phone: string;
  vehicle: string | null;
  plat_no: string | null;
  is_active: boolean;
  last_lat: string | null;
  last_location_at: string | null;
  created_at: string;
}

export default function KurirPage() {
  const { addToast } = useToast();
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ id: number; name: string; active: boolean } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    pin: '',
    vehicle: '',
    plat_no: '',
  });

  useEffect(() => {
    loadCouriers();
  }, []);

  async function loadCouriers() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/couriers');
      if (res.ok) {
        const data = await res.json();
        setCouriers(data.couriers || []);
      }
    } catch {
      addToast('error', 'Gagal memuat data kurir');
    }
    setLoading(false);
  }

  function resetForm() {
    setFormData({ name: '', phone: '', pin: '', vehicle: '', plat_no: '' });
    setEditingId(null);
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = editingId ? `/api/admin/couriers/${editingId}` : '/api/admin/couriers';
      const method = editingId ? 'PATCH' : 'POST';
      const body = editingId
        ? { name: formData.name, phone: formData.phone, vehicle: formData.vehicle || undefined, plat_no: formData.plat_no, ...(formData.pin ? { pin: formData.pin } : {}) }
        : { ...formData, vehicle: formData.vehicle || undefined };

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.ok) {
        addToast('success', editingId ? 'Kurir diperbarui' : 'Kurir ditambahkan');
        resetForm();
        loadCouriers();
      } else {
        addToast('error', data.error || 'Gagal menyimpan');
      }
    } catch {
      addToast('error', 'Gagal menyimpan data');
    }
  }

  async function handleToggleActive(courier: Courier) {
    setConfirmTarget({ id: courier.id, name: courier.name, active: courier.is_active });
    setConfirmOpen(true);
  }

  async function confirmToggle() {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    try {
      const res = await fetch(`/api/admin/couriers/${confirmTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !confirmTarget.active }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast('success', confirmTarget.active ? 'Kurir dinonaktifkan' : 'Kurir diaktifkan');
        loadCouriers();
      }
    } catch {
      addToast('error', 'Gagal mengubah status');
    }
    setConfirmLoading(false);
    setConfirmOpen(false);
    setConfirmTarget(null);
  }

  function startEdit(courier: Courier) {
    setFormData({
      name: courier.name,
      phone: courier.phone,
      pin: '',
      vehicle: courier.vehicle || '',
      plat_no: courier.plat_no || '',
    });
    setEditingId(courier.id);
    setShowForm(true);
  }

  const filtered = couriers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Truck className="w-7 h-7 text-orange-600" />
          <h1 className="text-2xl font-bold text-gray-800">Manajemen Kurir</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/kurir/assign">
            <Button variant="outline" className="border-orange-600 text-orange-600 hover:bg-orange-50">
              <Navigation className="w-4 h-4 mr-1" /> Assign Kurir
            </Button>
          </Link>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="bg-orange-600 hover:bg-orange-700">
            <Plus className="w-4 h-4 mr-1" /> Tambah Kurir
          </Button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Cari nama atau nomor telepon..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-4 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-700">{editingId ? 'Edit Kurir' : 'Tambah Kurir Baru'}</h2>
            <button type="button" onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Nama Lengkap *</label>
              <Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nama kurir" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Nomor Telepon *</label>
              <Input required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="081234567890" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">PIN (6 digit) {editingId && '(kosongkan jika tidak diubah)'}*</label>
              <Input required={!editingId} type="password" maxLength={6} value={formData.pin} onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="123456" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Kendaraan</label>
              <select value={formData.vehicle} onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">Pilih kendaraan</option>
                <option value="motor">Motor</option>
                <option value="mobil">Mobil</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Plat Nomor</label>
              <Input value={formData.plat_no} onChange={(e) => setFormData({ ...formData, plat_no: e.target.value })} placeholder="KT 1234 AB" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button type="submit" className="bg-orange-600 hover:bg-orange-700">{editingId ? 'Simpan' : 'Tambah Kurir'}</Button>
            <Button type="button" variant="outline" onClick={resetForm}>Batal</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Belum ada kurir. Tambahkan kurir pertama!</div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left p-3 font-medium text-gray-600">Nama</th>
                <th className="text-left p-3 font-medium text-gray-600">Telepon</th>
                <th className="text-left p-3 font-medium text-gray-600">Kendaraan</th>
                <th className="text-left p-3 font-medium text-gray-600">Plat</th>
                <th className="text-left p-3 font-medium text-gray-600">Status</th>
                <th className="text-left p-3 font-medium text-gray-600">Lokasi Terakhir</th>
                <th className="text-right p-3 font-medium text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3 text-gray-600">{c.phone}</td>
                  <td className="p-3 text-gray-600">{c.vehicle || '-'}</td>
                  <td className="p-3 text-gray-600">{c.plat_no || '-'}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {c.is_active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {c.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="p-3 text-gray-500 text-xs">
                    {c.last_location_at ? new Date(c.last_location_at).toLocaleString('id-ID') : '-'}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="outline" size="sm" onClick={() => startEdit(c)}>Edit</Button>
                      <Button variant={c.is_active ? "destructive" : "outline"} size="sm" onClick={() => handleToggleActive(c)}>
                        {c.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); setConfirmTarget(null); }}
        title={confirmTarget?.active ? 'Nonaktifkan Kurir' : 'Aktifkan Kurir'}
        message={`Yakin ingin ${confirmTarget?.active ? 'menonaktifkan' : 'mengaktifkan'} ${confirmTarget?.name}?`}
        confirmLabel={confirmLoading ? 'Memproses...' : 'Ya, Lanjutkan'}
        onConfirm={confirmToggle}
        variant={confirmTarget?.active ? 'danger' : 'primary'}
      />
    </div>
  );
}
