'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Plus, Edit2, Eye, EyeOff, Globe, Navigation } from 'lucide-react';
import { getAllZona, tambahZona, updateZona, nonaktifkanZona, aktifkanZona } from '@/actions/zona-pengiriman';
import { useToast } from '@/components/ui/toast';
import { CardSkeleton } from '@/components/ui/skeleton';

const MiniMap = dynamic(() => import('@/components/maps/MiniDeliveryMap').then((m) => ({ default: m.MiniDeliveryMap })), { ssr: false });

interface Zona {
  id: number;
  nama_zona: string;
  lat_pusat: string;
  lng_pusat: string;
  radius_km: number;
  ongkir_min: number;
  ongkir_max: number;
  total_order_bulan_ini: number | null;
  is_active: number;
}

export function DeliveryZonesManager() {
  const { addToast } = useToast();
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedZona, setSelectedZona] = useState<Zona | null>(null);
  const [form, setForm] = useState({
    nama_zona: '',
    lat_pusat: '',
    lng_pusat: '',
    radius_km: 5,
    ongkir_min: 0,
    ongkir_max: 0,
  });

  useEffect(() => {
    loadData().catch(console.error);
  }, []);

  async function loadData() {
    setLoading(true);
    const data = await getAllZona();
    setZonas(data);
    setLoading(false);
  }

  function resetForm() {
    setForm({ nama_zona: '', lat_pusat: '', lng_pusat: '', radius_km: 5, ongkir_min: 0, ongkir_max: 0 });
    setEditingId(null);
    setShowForm(false);
  }

  function editZona(z: Zona) {
    setForm({
      nama_zona: z.nama_zona,
      lat_pusat: z.lat_pusat,
      lng_pusat: z.lng_pusat,
      radius_km: z.radius_km,
      ongkir_min: z.ongkir_min,
      ongkir_max: z.ongkir_max,
    });
    setEditingId(z.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      const res = await updateZona(editingId, form);
      addToast(res.success ? 'success' : 'error', res.message);
    } else {
      const res = await tambahZona(form);
      addToast(res.success ? 'success' : 'error', res.message);
    }
    resetForm();
    await loadData();
  }

  async function handleToggle(z: Zona) {
    const res = z.is_active ? await nonaktifkanZona(z.id) : await aktifkanZona(z.id);
    addToast(res.success ? 'success' : 'error', res.message);
    await loadData();
  }

  function formatRupiah(n: number) {
    return 'Rp ' + n.toLocaleString('id-ID');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Zona Pengiriman</h2>
          <p className="text-on-surface-variant font-body-md mt-1">Kelola coverage area, radius antar jemput, dan rentang ongkir</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl font-label-md hover:opacity-90 transition-all shadow-sm"
        >
          <Plus size={18} /> Tambah Zona
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-label-md text-on-surface-variant mb-1">Nama Zona *</label>
              <input value={form.nama_zona} onChange={(e) => setForm({ ...form, nama_zona: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary" required />
            </div>
            <div>
              <label className="block text-xs font-label-md text-on-surface-variant mb-1">Latitude Pusat *</label>
              <input value={form.lat_pusat} onChange={(e) => setForm({ ...form, lat_pusat: e.target.value })} placeholder="-0.5022" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary" required />
            </div>
            <div>
              <label className="block text-xs font-label-md text-on-surface-variant mb-1">Longitude Pusat *</label>
              <input value={form.lng_pusat} onChange={(e) => setForm({ ...form, lng_pusat: e.target.value })} placeholder="117.1536" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary" required />
            </div>
            <div>
              <label className="block text-xs font-label-md text-on-surface-variant mb-1">Radius (km)</label>
              <input type="number" value={form.radius_km} onChange={(e) => setForm({ ...form, radius_km: +e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary" min={1} />
            </div>
            <div>
              <label className="block text-xs font-label-md text-on-surface-variant mb-1">Ongkir Minimal</label>
              <input type="number" value={form.ongkir_min} onChange={(e) => setForm({ ...form, ongkir_min: +e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary" min={0} />
            </div>
            <div>
              <label className="block text-xs font-label-md text-on-surface-variant mb-1">Ongkir Maksimal</label>
              <input type="number" value={form.ongkir_max} onChange={(e) => setForm({ ...form, ongkir_max: +e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary" min={0} />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-lg text-sm hover:bg-surface-container">Batal</button>
            <button type="submit" className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-label-md hover:opacity-90">
              {editingId ? 'Update' : 'Simpan'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : zonas.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">
          <MapPin size={48} className="mx-auto mb-3 text-outline-variant" />
          <p>Belum ada zona pengiriman. Tambah zona pertama!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {zonas.map((z) => (
            <div key={z.id} className={`bg-surface-container-lowest border border-neutral-200 rounded-xl overflow-hidden shadow-sm ${!z.is_active ? 'opacity-60' : ''}`}>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-fixed text-primary flex items-center justify-center">
                      <Globe size={20} />
                    </div>
                    <div>
                      <h3 className="font-label-md text-label-md text-on-surface">{z.nama_zona}</h3>
                      <p className="text-xs text-on-surface-variant">Zona #{z.id}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${z.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {z.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="bg-surface-container rounded-lg p-2 text-center">
                    <p className="text-xs text-on-surface-variant">Radius</p>
                    <p className="font-bold text-sm">{z.radius_km} km</p>
                  </div>
                  <div className="bg-surface-container rounded-lg p-2 text-center">
                    <p className="text-xs text-on-surface-variant">Ongkir Min</p>
                    <p className="font-bold text-sm">{formatRupiah(z.ongkir_min)}</p>
                  </div>
                  <div className="bg-surface-container rounded-lg p-2 text-center">
                    <p className="text-xs text-on-surface-variant">Ongkir Max</p>
                    <p className="font-bold text-sm">{formatRupiah(z.ongkir_max)}</p>
                  </div>
                </div>

                <div className="text-xs text-on-surface-variant flex items-center gap-1">
                  <Navigation size={12} />
                  {z.lat_pusat}, {z.lng_pusat}
                  {z.total_order_bulan_ini != null && <span className="ml-auto">Order bulan ini: {z.total_order_bulan_ini}</span>}
                </div>
              </div>

              <div className="h-40 bg-surface-container">
                {z.is_active && (
                  <MiniMap lat={parseFloat(z.lat_pusat)} lng={parseFloat(z.lng_pusat)} height={160} showGudang={true} />
                )}
              </div>

              <div className="flex items-center justify-between px-5 py-3 border-t border-outline-variant/20">
                <button onClick={() => setSelectedZona(z)} className="text-xs text-primary hover:underline">Lihat Detail</button>
                <div className="flex gap-1">
                  <button onClick={() => editZona(z)} className="p-1.5 hover:bg-surface-container rounded-lg text-on-surface-variant hover:text-primary">
                    <Edit2 size={15} />
                  </button>
                  <button onClick={() => handleToggle(z)} className={`p-1.5 hover:bg-surface-container rounded-lg ${z.is_active ? 'text-green-600' : 'text-on-surface-variant'}`}>
                    {z.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedZona && (
        <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-label-md text-label-md text-on-surface">Detail Zona: {selectedZona.nama_zona}</h3>
              <p className="text-on-surface-variant text-sm mt-1">Radius {selectedZona.radius_km} km, ongkir {formatRupiah(selectedZona.ongkir_min)} - {formatRupiah(selectedZona.ongkir_max)}</p>
            </div>
            <button onClick={() => setSelectedZona(null)} className="text-sm text-primary hover:underline">Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
}
