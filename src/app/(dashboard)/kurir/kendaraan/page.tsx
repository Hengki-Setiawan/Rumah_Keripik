'use client';

import { useState, useEffect, useCallback } from 'react';
import { Truck, Plus, X, Wrench } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface Vehicle {
  id: number;
  platNo: string;
  vehicleType: 'motor' | 'mobil';
  brandModel: string | null;
  year: number | null;
  capacityKg: number | null;
  status: 'active' | 'maintenance' | 'retired';
  assignedCourierId: number | null;
  courierName: string | null;
  odometerKm: number | null;
  lastServiceAt: string | null;
  nextServiceDueKm: number | null;
  insuranceExpiresAt: string | null;
  stnkExpiresAt: string | null;
}

interface VehicleLog {
  id: number;
  vehicleId: number;
  logType: string;
  costAmount: number | null;
  odometerKm: number | null;
  note: string | null;
  courierName: string | null;
  loggedAt: string;
}

const emptyForm = { platNo: '', vehicleType: 'motor' as 'motor' | 'mobil', brandModel: '', year: '', capacityKg: '' };

const statusBadge: Record<string, { label: string; cls: string }> = {
  active: { label: 'Aktif', cls: 'bg-green-100 text-green-700' },
  maintenance: { label: 'Perawatan', cls: 'bg-amber-100 text-amber-700' },
  retired: { label: 'Pensiun', cls: 'bg-gray-200 text-gray-600' },
};

const logTypeLabel: Record<string, string> = {
  bbm: 'BBM', servis: 'Servis', ganti_oli: 'Ganti Oli', ban: 'Ban', pajak: 'Pajak', insiden: 'Insiden', lainnya: 'Lainnya',
};

export default function KendaraanPage() {
  const { addToast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [summary, setSummary] = useState<{ total: number; active: number; maintenance: number; retired: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [logsFor, setLogsFor] = useState<Vehicle | null>(null);
  const [logs, setLogs] = useState<VehicleLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logForm, setLogForm] = useState({ logType: 'bbm', costAmount: '', odometerKm: '', note: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/vehicles');
      if (res.ok) {
        const data = await res.json();
        setVehicles(data.vehicles || []);
        setSummary(data.summary || null);
      }
    } catch {
      addToast('error', 'Gagal memuat kendaraan');
    }
    setLoading(false);
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  async function openLogs(v: Vehicle) {
    setLogsFor(v);
    setLogsLoading(true);
    setLogs([]);
    try {
      const res = await fetch(`/api/admin/vehicles/${v.id}/logs`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {
      addToast('error', 'Gagal memuat log');
    }
    setLogsLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/admin/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platNo: form.platNo,
          vehicleType: form.vehicleType,
          brandModel: form.brandModel || undefined,
          year: form.year ? Number(form.year) : undefined,
          capacityKg: form.capacityKg ? Number(form.capacityKg) : undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast('success', 'Kendaraan ditambahkan');
        setShowForm(false);
        setForm(emptyForm);
        load();
      } else {
        addToast('error', data.error || 'Gagal menambah kendaraan');
      }
    } catch {
      addToast('error', 'Gagal menambah kendaraan');
    }
    setBusy(false);
  }

  async function toggleStatus(v: Vehicle) {
    const next = v.status === 'active' ? 'maintenance' : v.status === 'maintenance' ? 'retired' : 'active';
    try {
      const res = await fetch(`/api/admin/vehicles/${v.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (data.ok) { addToast('success', `Status → ${next}`); load(); }
    } catch {
      addToast('error', 'Gagal ubah status');
    }
  }

  async function addLog(e: React.FormEvent) {
    e.preventDefault();
    if (!logsFor) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/vehicles/${logsFor.id}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logType: logForm.logType,
          costAmount: logForm.costAmount ? Number(logForm.costAmount) : undefined,
          odometerKm: logForm.odometerKm ? Number(logForm.odometerKm) : undefined,
          note: logForm.note || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast('success', 'Log tercatat');
        setLogForm({ logType: 'bbm', costAmount: '', odometerKm: '', note: '' });
        openLogs(logsFor);
        load();
      } else {
        addToast('error', data.error || 'Gagal catat log');
      }
    } catch {
      addToast('error', 'Gagal catat log');
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Truck className="w-6 h-6 text-orange-600" />
          <h1 className="text-xl font-bold text-gray-800">Kendaraan & Aset</h1>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-orange-600 hover:bg-orange-700">
          <Plus className="w-4 h-4 mr-1" /> Tambah Kendaraan
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-xl border p-4"><div className="text-2xl font-bold text-gray-800">{summary.total}</div><div className="text-sm text-gray-500">Total</div></div>
          <div className="bg-green-50 rounded-xl border border-green-200 p-4"><div className="text-2xl font-bold text-green-700">{summary.active}</div><div className="text-sm text-green-600">Aktif</div></div>
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4"><div className="text-2xl font-bold text-amber-700">{summary.maintenance}</div><div className="text-sm text-amber-600">Perawatan</div></div>
          <div className="bg-gray-100 rounded-xl border p-4"><div className="text-2xl font-bold text-gray-500">{summary.retired}</div><div className="text-sm text-gray-500">Pensiun</div></div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-4 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-700">Tambah Kendaraan Baru</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Plat Nomor *</label>
              <Input required value={form.platNo} onChange={(e) => setForm({ ...form, platNo: e.target.value })} placeholder="DD 1234 AB" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Tipe</label>
              <select value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value as 'motor' | 'mobil' })} className="w-full rounded-lg border px-3 py-2 text-sm">
                <option value="motor">Motor</option>
                <option value="mobil">Mobil</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Merk / Model</label>
              <Input value={form.brandModel} onChange={(e) => setForm({ ...form, brandModel: e.target.value })} placeholder="Honda Beat 2022" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Tahun</label>
              <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="2022" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Kapasitas (kg)</label>
              <Input type="number" value={form.capacityKg} onChange={(e) => setForm({ ...form, capacityKg: e.target.value })} placeholder="50" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button type="submit" disabled={busy} className="bg-orange-600 hover:bg-orange-700">Tambah</Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Batal</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-3"><CardSkeleton /></div>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Belum ada kendaraan terdaftar.</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left p-3 font-medium text-gray-600">Kendaraan</th>
                <th className="text-left p-3 font-medium text-gray-600">Tipe</th>
                <th className="text-left p-3 font-medium text-gray-600">Kurir</th>
                <th className="text-right p-3 font-medium text-gray-600">Odometer</th>
                <th className="text-right p-3 font-medium text-gray-600">Servis Terakhir</th>
                <th className="text-center p-3 font-medium text-gray-600">Status</th>
                <th className="text-right p-3 font-medium text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => {
                const sb = statusBadge[v.status] || { label: v.status, cls: 'bg-gray-100 text-gray-600' };
                return (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-medium">{v.platNo}</div>
                      <div className="text-xs text-gray-400">{v.brandModel || '–'}</div>
                    </td>
                    <td className="p-3 text-gray-600 capitalize">{v.vehicleType}</td>
                    <td className="p-3">{v.courierName || <span className="text-gray-300">–</span>}</td>
                    <td className="p-3 text-right text-gray-600">{v.odometerKm != null ? `${v.odometerKm.toLocaleString()} km` : '–'}</td>
                    <td className="p-3 text-right text-gray-600 text-xs">{v.lastServiceAt ? v.lastServiceAt.slice(0, 10) : '–'}</td>
                    <td className="p-3 text-center"><Badge className={sb.cls}>{sb.label}</Badge></td>
                    <td className="p-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="outline" size="sm" onClick={() => openLogs(v)}><Wrench className="w-3.5 h-3.5 mr-1" /> Log</Button>
                        <Button variant="outline" size="sm" onClick={() => toggleStatus(v)}>Ubah Status</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {logsFor && (
        <Modal
          open={!!logsFor}
          onClose={() => setLogsFor(null)}
          title={`Log Kendaraan ${logsFor.platNo}`}
          width="max-w-2xl"
        >
          <div className="space-y-4">
            <form onSubmit={addLog} className="bg-gray-50 rounded-lg p-3 border space-y-2">
              <h4 className="text-sm font-semibold text-gray-700">Catat Pengeluaran</h4>
              <div className="grid grid-cols-2 gap-2">
                <select value={logForm.logType} onChange={(e) => setLogForm({ ...logForm, logType: e.target.value })} className="rounded-lg border px-2 py-2 text-sm">
                  {Object.entries(logTypeLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <Input type="number" placeholder="Biaya (Rp)" value={logForm.costAmount} onChange={(e) => setLogForm({ ...logForm, costAmount: e.target.value })} />
                <Input type="number" placeholder="Odometer (km)" value={logForm.odometerKm} onChange={(e) => setLogForm({ ...logForm, odometerKm: e.target.value })} />
              </div>
              <Input placeholder="Catatan" value={logForm.note} onChange={(e) => setLogForm({ ...logForm, note: e.target.value })} />
              <Button type="submit" disabled={busy} size="sm" className="bg-orange-600 hover:bg-orange-700">Simpan Log</Button>
            </form>

            {logsLoading ? (
              <div className="text-center py-4 text-gray-400 text-sm">Memuat...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-4 text-gray-400 text-sm">Belum ada log.</div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {logs.map((l) => (
                  <div key={l.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <div>
                      <span className="font-medium">{logTypeLabel[l.logType] || l.logType}</span>
                      <span className="text-xs text-gray-400 ml-2">{l.loggedAt.slice(0, 16).replace('T', ' ')}</span>
                      {l.note && <div className="text-xs text-gray-500">{l.note}</div>}
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{l.costAmount != null ? rupiah(l.costAmount) : '–'}</div>
                      {l.odometerKm != null && <div className="text-xs text-gray-400">{l.odometerKm} km</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

const rupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
