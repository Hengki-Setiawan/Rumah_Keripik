'use client';

import { useEffect, useState } from 'react';
import { Users, Wifi, WifiOff, ChevronDown, Search, RotateCcw, Clock } from 'lucide-react';

interface Courier {
  id: number;
  name: string;
  phone: string;
  email: string;
  vehicleType: string;
  status: string;
  currentLocation: string;
  lastActiveAt: string;
  activeShift: { id: number; clockInAt: string } | null;
  completedToday: number;
  rating: number;
}

export default function CouriersPage() {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
      fetch('/api/admin/couriers')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setCouriers((d.couriers || []).map((c: any) => ({
            ...c,
            vehicleType: c.vehicle || c.vehicleType,
            email: c.email || '',
            status: c.is_active ? 'online' : 'offline',
            completedToday: c.completedToday || 0,
            rating: c.rating || 0,
            currentLocation: c.last_lat ? `${c.last_lat}, ${c.last_lng}` : '',
            lastActiveAt: c.last_location_at || c.updated_at || '',
            activeShift: c.activeShift || null,
          })));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = couriers.filter((c) => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search);
    if (!matchSearch) return false;
    if (filter === 'online') return c.status === 'online';
    if (filter === 'offline') return c.status === 'offline';
    if (filter === 'on_shift') return !!c.activeShift;
    return true;
  });

  if (loading) return <div className="p-6 text-gray-500">Memuat data kurir...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users /> Manajemen Kurir</h1>
        <div className="flex gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              className="pl-9 pr-4 py-2 border rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Cari nama/telepon..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Semua Status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="on_shift">Sedang Shift</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left p-3">Kurir</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Kendaraan</th>
              <th className="text-left p-3">Shift</th>
              <th className="text-center p-3">Hari Ini</th>
              <th className="text-center p-3">Rating</th>
              <th className="text-center p-3">Terakhir Aktif</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t hover:bg-gray-50">
                <td className="p-3">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-gray-400 text-xs">{c.phone}</div>
                </td>
                <td className="p-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                    c.status === 'online' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {c.status === 'online' ? <Wifi size={12} /> : <WifiOff size={12} />}
                    {c.status === 'online' ? 'Online' : 'Offline'}
                  </span>
                </td>
                <td className="p-3 text-gray-600">{c.vehicleType || '-'}</td>
                <td className="p-3">
                  {c.activeShift ? (
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      <Clock size={12} className="inline mr-1" />
                      {new Date(c.activeShift.clockInAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  ) : <span className="text-xs text-gray-400">-</span>}
                </td>
                <td className="p-3 text-center font-semibold">{c.completedToday || 0}</td>
                <td className="p-3 text-center">
                  <span className="text-amber-500 font-semibold">{(c.rating || 0).toFixed(1)}</span>
                </td>
                <td className="p-3 text-center text-gray-400 text-xs">
                  {c.lastActiveAt ? new Date(c.lastActiveAt).toLocaleString('id-ID') : '-'}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-gray-400">Tidak ada kurir ditemukan</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
