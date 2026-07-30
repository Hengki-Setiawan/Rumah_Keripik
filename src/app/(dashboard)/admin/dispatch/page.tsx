'use client';

import { useEffect, useState, useCallback } from 'react';
import { Truck, MapPin, RefreshCw, UserCheck, Clock } from 'lucide-react';

interface Delivery {
  id: number;
  customerName: string;
  customerAddress: string;
  kurirName: string;
  kurirId: number;
  status: string;
  createdAt: string;
  lat: string;
  lng: string;
}

interface Courier {
  id: number;
  name: string;
  status: string;
}

export default function DispatchPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [reassigning, setReassigning] = useState<number | null>(null);
  const [selectedFilter, setSelectedFilter] = useState('Siap_Dikirim');
  const [draggedDelivery, setDraggedDelivery] = useState<Delivery | null>(null);

  const statusMap: Record<string, string> = {
    pending: 'Siap_Dikirim',
    in_transit: 'Dalam_Pengiriman',
    completed: 'Terkirim',
    cancelled: 'Gagal',
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [dRes, cRes] = await Promise.all([
      fetch('/api/admin/deliveries'),
      fetch('/api/admin/couriers'),
    ]);
    const d = await dRes.json();
    const c = await cRes.json();
    if (d.ok) setDeliveries(d.data || []);
    if (c.ok) {
      const raw = c.couriers || [];
      setCouriers(raw.map((x: any) => ({ id: x.id, name: x.name, status: x.is_active ? 'online' : 'offline' })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleReassign = async (deliveryId: number, newKurirId: number) => {
    setReassigning(deliveryId);
    await fetch('/api/admin/dispatch/reassign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryId, newKurirId }),
    });
    setReassigning(null);
    fetchData();
  };

  const onDragStart = (d: Delivery) => {
    setDraggedDelivery(d);
  };

  const onDropOnCourier = async (courierId: number) => {
    if (!draggedDelivery || draggedDelivery.kurirId === courierId) return;
    await handleReassign(draggedDelivery.id, courierId);
    setDraggedDelivery(null);
  };

  const filtered = deliveries.filter((d) => {
    if (selectedFilter === 'all') return true;
    return d.status === (statusMap[selectedFilter] || selectedFilter);
  });

  if (loading) return <div className="p-6 text-gray-500">Memuat data dispatch...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Truck /> Dispatch Center</h1>
        <button onClick={fetchData} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="flex gap-2">
        {[
          { key: 'Siap_Dikirim', label: 'Siap Dikirim' },
          { key: 'Dalam_Pengiriman', label: 'Diantar' },
          { key: 'Terkirim', label: 'Selesai' },
          { key: 'Gagal', label: 'Gagal' },
          { key: 'all', label: 'Semua' },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setSelectedFilter(s.key)}
            className={`px-3 py-1.5 rounded-lg text-sm ${selectedFilter === s.key ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-6">
        <div className="space-y-3">
          {filtered.map((d) => {
            const statusColors: Record<string, string> = {
              Terkirim: 'bg-emerald-100 text-emerald-700',
              Dalam_Pengiriman: 'bg-blue-100 text-blue-700',
              Gagal: 'bg-red-100 text-red-700',
              Siap_Dikirim: 'bg-yellow-100 text-yellow-700',
            };
            return (
              <div
                key={d.id}
                draggable={d.status === 'Siap_Dikirim'}
                onDragStart={() => onDragStart(d)}
                className={`bg-white rounded-lg shadow-sm border p-4 ${d.status === 'Siap_Dikirim' ? 'cursor-grab active:cursor-grabbing hover:border-amber-300' : ''} ${draggedDelivery?.id === d.id ? 'opacity-40 ring-2 ring-amber-400' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{d.customerName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${statusColors[d.status] || 'bg-gray-100 text-gray-700'}`}>
                        {d.status === 'Siap_Dikirim' ? 'Siap Dikirim' : d.status}
                      </span>
                    </div>
                    <div className="flex items-start gap-1 text-sm text-gray-500 mb-2">
                      <MapPin size={14} className="mt-0.5 shrink-0" />
                      <span>{d.customerAddress}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Clock size={12} />{new Date(d.createdAt).toLocaleString('id-ID')}</span>
                      <span className="flex items-center gap-1"><Truck size={12} />Kurir: {d.kurirName || 'Belum ditugaskan'}</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    {d.status === 'Siap_Dikirim' && (
                      <div className="flex items-center gap-2">
                        {d.kurirName ? (
                          <span className="text-xs text-gray-400">{d.kurirName}</span>
                        ) : (
                          <select
                            className="border rounded px-2 py-1 text-xs"
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) handleReassign(d.id, Number(e.target.value));
                            }}
                            disabled={reassigning === d.id}
                          >
                            <option value="" disabled>Assign ke...</option>
                            {couriers.filter((c) => c.status === 'online').map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                    {d.status === 'Dalam_Pengiriman' && d.kurirId && (
                      <button
                        onClick={() => handleReassign(d.id, 0)}
                        className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700"
                        disabled={reassigning === d.id}
                      >
                        <UserCheck size={14} /> Reassign
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center text-gray-400 py-10">Tidak ada delivery</div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4 h-fit sticky top-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <UserCheck size={14} /> Kurir Online
          </h3>
          {draggedDelivery && (
            <div className="text-xs text-amber-600 bg-amber-50 rounded p-2 mb-3">
              Drop ke kurir untuk assign: {draggedDelivery.customerName}
            </div>
          )}
          <div className="space-y-2">
            {couriers.filter((c) => c.status === 'online').map((c) => (
              <div
                key={c.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDropOnCourier(c.id)}
                className={`flex items-center gap-2 p-2 rounded-lg text-sm transition-colors ${draggedDelivery ? 'border-2 border-dashed border-amber-300 bg-amber-50 cursor-pointer hover:bg-amber-100' : 'hover:bg-gray-50'}`}
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-medium">{c.name}</span>
              </div>
            ))}
            {couriers.filter((c) => c.status === 'online').length === 0 && (
              <div className="text-xs text-gray-400">Tidak ada kurir online</div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t">
            <h4 className="text-xs font-medium text-gray-500 mb-2">Offline</h4>
            {couriers.filter((c) => c.status !== 'online').map((c) => (
              <div key={c.id} className="flex items-center gap-2 p-2 text-sm text-gray-400">
                <div className="w-2 h-2 rounded-full bg-gray-300" />
                <span>{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
