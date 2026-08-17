'use client';

import {useState, useEffect} from 'react';
import {Truck, Search, MapPin, ArrowLeft, GitBranch} from 'lucide-react';
import {useToast} from '@/components/ui/toast';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {CardSkeleton} from '@/components/ui/skeleton';
import Link from 'next/link';

interface PendingDelivery {
  id_transaksi: string;
  kode_pesanan: string;
  nama_penerima: string;
  alamat_penerima: string;
  no_hp_penerima: string;
  order_status: string;
  created_at: string;
}

interface Courier {
  id: number;
  name: string;
  phone: string;
  vehicle: string | null;
  is_active: boolean;
}

interface OpenRoute {
  id: number;
  routeName: string;
  stopCount: number;
  status: string;
}

export default function AssignCourierPage() {
  const { addToast } = useToast();
  const [deliveries, setDeliveries] = useState<PendingDelivery[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [routes, setRoutes] = useState<OpenRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedCourier, setSelectedCourier] = useState<Record<string, number>>({});
  const [selectedRoute, setSelectedRoute] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [delRes, couRes, routeRes] = await Promise.all([
        fetch('/api/admin/deliveries/pending'),
        fetch('/api/admin/couriers'),
        fetch('/api/admin/routes'),
      ]);
      const delData = await delRes.json();
      const couData = await couRes.json();
      const routeData = await routeRes.json();
      setDeliveries(delData.deliveries || []);
      setCouriers((couData.couriers || []).filter((c: Courier) => c.is_active));
      setRoutes((routeData.routes || []).filter((r: OpenRoute) => r.status === 'open'));
    } catch {
      addToast('error', 'Gagal memuat data');
    }
    setLoading(false);
  }

  async function handleAssign(id_transaksi: string) {
    const kurir_id = selectedCourier[id_transaksi];
    if (!kurir_id) {
      addToast('error', 'Pilih kurir terlebih dahulu');
      return;
    }

    setAssigningId(id_transaksi);
    try {
      const res = await fetch('/api/admin/couriers/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_transaksi, kurir_id }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast('success', 'Kurir berhasil ditugaskan');
        setDeliveries((prev) => prev.filter((d) => d.id_transaksi !== id_transaksi));
      } else {
        addToast('error', data.error || 'Gagal menugaskan');
      }
    } catch {
      addToast('error', 'Gagal menugaskan kurir');
    }
    setAssigningId(null);
  }

  async function handleAddToRoute(id_transaksi: string) {
    const routeId = selectedRoute[id_transaksi];
    if (!routeId) {
      addToast('error', 'Pilih jalur terlebih dahulu');
      return;
    }

    setAssigningId(id_transaksi);
    try {
      const res = await fetch(`/api/admin/routes/${routeId}/stops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idTransaksi: id_transaksi }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast('success', 'Pesanan dimasukkan ke jalur');
        setDeliveries((prev) => prev.filter((d) => d.id_transaksi !== id_transaksi));
      } else {
        addToast('error', data.error || 'Gagal memasukkan ke jalur');
      }
    } catch {
      addToast('error', 'Gagal memasukkan ke jalur');
    }
    setAssigningId(null);
  }

  const filtered = deliveries.filter(
    (d) =>
      d.kode_pesanan.toLowerCase().includes(search.toLowerCase()) ||
      d.nama_penerima?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/kurir" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Truck className="w-7 h-7 text-orange-600" />
        <h1 className="text-2xl font-bold text-gray-800">Assign Kurir</h1>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Cari pesanan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="space-y-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">Tidak ada pengiriman yang menunggu kurir.</p>
          <p className="text-gray-400 text-sm mt-1">Ubah status pesanan menjadi &quot;Kirim&quot; dulu di halaman Transaksi.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <div key={d.id_transaksi} className="bg-white rounded-lg border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {d.kode_pesanan}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString('id-ID')}</span>
                  </div>
                  <p className="font-semibold text-gray-800">{d.nama_penerima || '(tanpa nama)'}</p>
                  <p className="text-sm text-gray-500 flex items-start gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{d.alamat_penerima}</span>
                  </p>
                  {d.no_hp_penerima && (
                    <p className="text-sm text-gray-400 mt-1">{d.no_hp_penerima}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={selectedRoute[d.id_transaksi] || ''}
                    onChange={(e) =>
                      setSelectedRoute((prev) => ({ ...prev, [d.id_transaksi]: parseInt(e.target.value) }))
                    }
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[150px]"
                    data-testid={`assign-route-select-${d.id_transaksi}`}
                  >
                    <option value="">Masukkan ke jalur…</option>
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.routeName} ({r.stopCount} stop)
                      </option>
                    ))}
                  </select>

                  <Button
                    onClick={() => handleAddToRoute(d.id_transaksi)}
                    disabled={assigningId === d.id_transaksi || !selectedRoute[d.id_transaksi]}
                    className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
                    data-testid={`assign-to-route-${d.id_transaksi}`}
                  >
                    <GitBranch className="w-4 h-4 mr-1" />
                    {assigningId === d.id_transaksi ? '...' : 'Ke Jalur'}
                  </Button>

                  <select
                    value={selectedCourier[d.id_transaksi] || ''}
                    onChange={(e) =>
                      setSelectedCourier((prev) => ({ ...prev, [d.id_transaksi]: parseInt(e.target.value) }))
                    }
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 min-w-[140px]"
                    data-testid={`assign-courier-select-${d.id_transaksi}`}
                  >
                    <option value="">Pilih kurir...</option>
                    {couriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.vehicle ? `(${c.vehicle})` : ''}
                      </option>
                    ))}
                  </select>

                  <Button
                    onClick={() => handleAssign(d.id_transaksi)}
                    disabled={assigningId === d.id_transaksi || !selectedCourier[d.id_transaksi]}
                    className="bg-orange-600 hover:bg-orange-700 shrink-0"
                    data-testid={`assign-courier-button-${d.id_transaksi}`}
                  >
                    {assigningId === d.id_transaksi ? '...' : 'Assign'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
