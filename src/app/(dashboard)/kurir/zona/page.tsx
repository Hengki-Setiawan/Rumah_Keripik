'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPinned, Plus, X } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmModal } from '@/components/ui/modal';
import { CardSkeleton } from '@/components/ui/skeleton';

interface Zone {
  id: number;
  nama_zona: string;
  lat_pusat: string;
  lng_pusat: string;
  radius_km: number;
  ongkir_min: number;
  ongkir_max: number;
  total_order_bulan_ini: number | null;
  is_active: boolean;
}

const empty = { nama_zona: '', lat_pusat: '', lng_pusat: '', radius_km: 5, ongkir_min: 0, ongkir_max: 0 };

export default function ZonaPage() {
  const { addToast } = useToast();
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(empty);
  const [confirmDel, setConfirmDel] = useState<Zone | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/zones');
      if (res.ok) {
        const data = await res.json();
        setZones(data.zones || []);
      }
    } catch {
      addToast('error', 'Gagal memuat zona');
    }
    setLoading(false);
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  function resetForm() { setForm(empty); setEditingId(null); setShowForm(false); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const url = editingId ? `/api/admin/zones/${editingId}` : '/api/admin/zones';
      const method = editingId ? 'PATCH' : 'POST';
      const body = {
        ...form,
        radius_km: Number(form.radius_km),
        ongkir_min: Number(form.ongkir_min),
        ongkir_max: Number(form.ongkir_max),
      };
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.ok) {
        addToast('success', editingId ? 'Zona diperbarui' : 'Zona ditambahkan');
        resetForm();
        load();
      } else {
        addToast('error', data.error || 'Gagal menyimpan zona');
      }
    } catch {
      addToast('error', 'Gagal menyimpan zona');
    }
    setBusy(false);
  }

  async function toggleActive(z: Zone) {
    try {
      const res = await fetch(`/api/admin/zones/${z.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: z.is_active ? 0 : 1 }),
      });
      const data = await res.json();
      if (data.ok) { addToast('success', z.is_active ? 'Zona dinonaktifkan' : 'Zona diaktifkan'); load(); }
    } catch {
      addToast('error', 'Gagal mengubah status');
    }
  }

  async function doDelete() {
    if (!confirmDel) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/zones/${confirmDel.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) { addToast('success', 'Zona dihapus'); load(); }
    } catch {
      addToast('error', 'Gagal menghapus zona');
    }
    setBusy(false);
    setConfirmDel(null);
  }

  function startEdit(z: Zone) {
    setForm({ nama_zona: z.nama_zona, lat_pusat: z.lat_pusat, lng_pusat: z.lng_pusat, radius_km: z.radius_km, ongkir_min: z.ongkir_min, ongkir_max: z.ongkir_max });
    setEditingId(z.id);
    setShowForm(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MapPinned className="w-6 h-6 text-orange-600" />
          <h1 className="text-xl font-bold text-gray-800">Zona & Geofence</h1>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="bg-orange-600 hover:bg-orange-700">
          <Plus className="w-4 h-4 mr-1" /> Tambah Zona
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-4 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-700">{editingId ? 'Edit Zona' : 'Tambah Zona Baru'}</h2>
            <button type="button" onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Nama Zona *</label>
              <Input required value={form.nama_zona} onChange={(e) => setForm({ ...form, nama_zona: e.target.value })} placeholder="Makassar Utara" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Lat Pusat *</label>
              <Input required value={form.lat_pusat} onChange={(e) => setForm({ ...form, lat_pusat: e.target.value })} placeholder="-5.1340" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Lng Pusat *</label>
              <Input required value={form.lng_pusat} onChange={(e) => setForm({ ...form, lng_pusat: e.target.value })} placeholder="119.4135" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Radius (km)</label>
              <Input type="number" min={1} max={500} value={form.radius_km} onChange={(e) => setForm({ ...form, radius_km: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Ongkir Min (Rp)</label>
              <Input type="number" min={0} value={form.ongkir_min} onChange={(e) => setForm({ ...form, ongkir_min: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Ongkir Max (Rp)</label>
              <Input type="number" min={0} value={form.ongkir_max} onChange={(e) => setForm({ ...form, ongkir_max: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button type="submit" disabled={busy} className="bg-orange-600 hover:bg-orange-700">{editingId ? 'Simpan' : 'Tambah Zona'}</Button>
            <Button type="button" variant="outline" onClick={resetForm}>Batal</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-3"><CardSkeleton /><CardSkeleton /></div>
      ) : zones.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Belum ada zona. Tambahkan zona pengiriman pertama!</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left p-3 font-medium text-gray-600">Zona</th>
                <th className="text-left p-3 font-medium text-gray-600">Pusat (lat,lng)</th>
                <th className="text-right p-3 font-medium text-gray-600">Radius (km)</th>
                <th className="text-right p-3 font-medium text-gray-600">Ongkir</th>
                <th className="text-right p-3 font-medium text-gray-600">Order Bulan Ini</th>
                <th className="text-center p-3 font-medium text-gray-600">Status</th>
                <th className="text-right p-3 font-medium text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-3 font-medium">{z.nama_zona}</td>
                  <td className="p-3 text-gray-600 text-xs">{z.lat_pusat}, {z.lng_pusat}</td>
                  <td className="p-3 text-right text-gray-700">{z.radius_km}</td>
                  <td className="p-3 text-right text-gray-700">{rupiah(z.ongkir_min)} – {rupiah(z.ongkir_max)}</td>
                  <td className="p-3 text-right text-gray-700">{z.total_order_bulan_ini ?? 0}</td>
                  <td className="p-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${z.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {z.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="outline" size="sm" onClick={() => startEdit(z)}>Edit</Button>
                      <Button variant={z.is_active ? 'destructive' : 'outline'} size="sm" onClick={() => toggleActive(z)}>{z.is_active ? 'Nonaktifkan' : 'Aktifkan'}</Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDel(z)}>Hapus</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Hapus Zona"
        message={`Yakin ingin menghapus zona "${confirmDel?.nama_zona}"?`}
        confirmLabel={busy ? 'Memproses...' : 'Ya, Hapus'}
        onConfirm={doDelete}
        variant="danger"
      />
    </div>
  );
}

const rupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);