'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Route as RouteIcon, UserPlus, Trash2, Play, CheckCircle2, Sparkles } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/ui/skeleton';

interface RouteStop {
  id: number;
  idTransaksi: string;
  sequenceNo: number;
  lat: string | null;
  lng: string | null;
  address: string | null;
  kodePesanan: string | null;
  penerima: string | null;
}

interface DeliveryRoute {
  id: number;
  routeName: string;
  routeDate: string;
  status: string;
  courierId: number | null;
  courierName: string | null;
  warehouseName: string | null;
  stopCount: number;
  estimatedDistanceKm: string | null;
  stops: RouteStop[];
}

interface CourierOption {
  id: number;
  name: string;
  phone: string;
  is_active: number;
}

const routeStatusColor: Record<string, string> = {
  open: 'bg-emerald-100 text-emerald-700',
  claimed: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function JalurPage() {
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const [routes, setRoutes] = useState<DeliveryRoute[]>([]);
  const [couriers, setCouriers] = useState<CourierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(searchParams.get('routeDate') || new Date().toISOString().slice(0, 10));
  const [building, setBuilding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = date ? `?routeDate=${date}` : '';
      const [routesRes, couriersRes] = await Promise.all([
        fetch(`/api/admin/routes${qs}`),
        fetch('/api/admin/couriers'),
      ]);
      if (routesRes.ok) {
        const data = await routesRes.json();
        setRoutes(data.routes || []);
      }
      if (couriersRes.ok) {
        const data = await couriersRes.json();
        setCouriers(data.couriers || data.data?.couriers || []);
      }
    } catch {
      addToast('error', 'Gagal memuat jalur');
    }
    setLoading(false);
  }, [date, addToast]);

  useEffect(() => { load(); }, [load]);

  async function autoBuild() {
    setBuilding(true);
    try {
      const res = await fetch(`/api/admin/routes?routeDate=${date}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto: true }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast('success', `Auto-buat selesai: ${data.data?.routesCreated ?? 0} jalur (${data.data?.ordersClustered ?? 0} pesanan)`);
        load();
      } else {
        addToast('error', data.error || 'Gagal auto-buat jalur');
      }
    } catch {
      addToast('error', 'Gagal auto-buat jalur');
    }
    setBuilding(false);
  }

  async function assignCourier(routeId: number, courierId: number) {
    try {
      const res = await fetch(`/api/admin/routes/${routeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courierId }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast('success', 'Kurir ditugaskan ke jalur');
        load();
      } else {
        addToast('error', data.error || 'Gagal assign kurir');
      }
    } catch {
      addToast('error', 'Gagal assign kurir');
    }
  }

  async function releaseCourier(routeId: number) {
    try {
      const res = await fetch(`/api/admin/routes/${routeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courierId: null }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast('success', 'Jalur dikembalikan ke open');
        load();
      } else {
        addToast('error', data.error || 'Gagal melepas kurir');
      }
    } catch {
      addToast('error', 'Gagal melepas kurir');
    }
  }

  async function optimizeRoute(routeId: number) {
    try {
      const optimizeRes = await fetch(`/api/admin/routes/${routeId}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await optimizeRes.json();
      if (data.ok) {
        addToast('success', 'Urutan jalur dioptimalkan');
        load();
      } else {
        addToast('error', data.error || 'Gagal optimasi');
      }
    } catch {
      addToast('error', 'Gagal optimasi');
    }
  }

  async function setStatus(routeId: number, status: string) {
    try {
      const res = await fetch(`/api/admin/routes/${routeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast('success', `Status diubah ke ${status}`);
        load();
      } else {
        addToast('error', data.error || 'Gagal update status');
      }
    } catch {
      addToast('error', 'Gagal update status');
    }
  }

  async function deleteRoute(routeId: number) {
    if (!window.confirm('Hapus jalur ini? Pesanan akan kembali ke processing.')) return;
    try {
      const res = await fetch(`/api/admin/routes/${routeId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        addToast('success', 'Jalur dihapus');
        load();
      } else {
        addToast('error', data.error || 'Gagal hapus jalur');
      }
    } catch {
      addToast('error', 'Gagal hapus jalur');
    }
  }

  const openRoutes = routes.filter((r) => r.status === 'open');
  const activeRoutes = routes.filter((r) => r.status === 'claimed' || r.status === 'in_progress');
  const doneRoutes = routes.filter((r) => r.status === 'completed' || r.status === 'cancelled');

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <RouteIcon className="w-6 h-6 text-orange-600" />
          <h1 className="text-xl font-bold text-gray-800">Kelola Jalur</h1>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            data-testid="jalur-date-input"
          />
          <Button onClick={autoBuild} disabled={building} className="bg-orange-600 hover:bg-orange-700" data-testid="jalur-auto-build-button">
            <Sparkles className={`w-4 h-4 mr-1 ${building ? 'animate-pulse' : ''}`} />
            {building ? 'Membangun...' : 'Auto-Buat Jalur'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3"><CardSkeleton /><CardSkeleton /></div>
      ) : routes.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          Belum ada jalur untuk tanggal ini. Klik &quot;Auto-Buat Jalur&quot; — sistem membentuk jalur sebanyak kurir terdaftar dan mengelompokkan pesanan per wilayah.
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-gray-500 mb-2">Tersedia (open) — {openRoutes.length}</h2>
            {openRoutes.length === 0 ? (
              <p className="text-sm text-gray-400">Tidak ada jalur open.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {openRoutes.map((r) => (
                  <div key={r.id} className="bg-white rounded-xl border p-4" data-testid={`jalur-card-${r.id}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-semibold text-gray-800">{r.routeName}</div>
                        <div className="text-xs text-gray-400">{r.warehouseName || 'Gudang 1'} · {r.stopCount} stop{r.estimatedDistanceKm ? ` · ~${r.estimatedDistanceKm} km` : ''}</div>
                      </div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${routeStatusColor[r.status]}`}>{r.status}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <select
                        className="rounded-lg border px-2 py-1.5 text-sm"
                        defaultValue=""
                        data-testid={`jalur-assign-select-${r.id}`}
                        onChange={(e) => { if (e.target.value) assignCourier(r.id, Number(e.target.value)); }}
                      >
                        <option value="">Assign kurir…</option>
                        {couriers.filter((c) => c.is_active === 1).map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <Button variant="ghost" size="sm" onClick={() => optimizeRoute(r.id)} data-testid={`jalur-optimize-${r.id}`}>
                        Optimasi
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteRoute(r.id)} data-testid={`jalur-delete-${r.id}`}>
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {r.stops.map((s) => (
                        <div key={s.id} className="flex items-center gap-2 text-xs text-gray-600">
                          <span className="font-mono text-gray-400 w-4">{s.sequenceNo}</span>
                          <span className="font-medium">{s.kodePesanan || s.idTransaksi}</span>
                          <span className="text-gray-400 truncate flex-1">{s.address || s.penerima}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-500 mb-2">Aktif (claimed / in progress) — {activeRoutes.length}</h2>
            {activeRoutes.length === 0 ? (
              <p className="text-sm text-gray-400">Tidak ada jalur aktif.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {activeRoutes.map((r) => (
                  <div key={r.id} className="bg-white rounded-xl border p-4" data-testid={`jalur-active-card-${r.id}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-semibold text-gray-800">{r.routeName}</div>
                        <div className="text-xs text-gray-400">
                          {r.courierName || 'Belum ada kurir'} · {r.stopCount} stop
                        </div>
                      </div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${routeStatusColor[r.status]}`}>{r.status}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.status === 'claimed' && (
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => setStatus(r.id, 'in_progress')} data-testid={`jalur-start-${r.id}`}>
                          <Play className="w-3.5 h-3.5 mr-1" /> Mulai
                        </Button>
                      )}
                      <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setStatus(r.id, 'completed')} data-testid={`jalur-complete-${r.id}`}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Selesai
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => releaseCourier(r.id)}>
                        <UserPlus className="w-3.5 h-3.5 mr-1" /> Lepas Kurir
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => optimizeRoute(r.id)}>Optimasi</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {doneRoutes.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 mb-2">Selesai / Dibatalkan — {doneRoutes.length}</h2>
              <div className="flex flex-wrap gap-2">
                {doneRoutes.map((r) => (
                  <span key={r.id} className="inline-flex items-center gap-2 bg-white border rounded-full px-3 py-1 text-xs text-gray-600">
                    {r.routeName}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${routeStatusColor[r.status]}`}>{r.status}</span>
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}