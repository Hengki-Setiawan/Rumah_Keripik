'use client';

import { useEffect, useState } from 'react';
import { Activity, Wifi, AlertTriangle, CheckCircle } from 'lucide-react';

interface SyncHealth {
  totalCouriers: number;
  onlineNow: number;
  offlineQueueTotal: number;
  avgSyncDelaySeconds: number;
  stuckItems: number;
  couriers: Array<{ id: string; name: string; queueSize: number; lastSyncAt: string; status: string }>;
}

export default function SyncHealthPage() {
  const [data, setData] = useState<SyncHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/sync-health')
      .then((r) => r.json()).then((d) => { if (d.ok) setData(d); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-gray-500">Memuat kesehatan sinkronisasi...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Activity /> Kesehatan Sinkronisasi</h1>
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <Wifi size={20} className="text-blue-500 mb-1" />
          <div className="text-2xl font-bold">{data?.onlineNow || 0}/{data?.totalCouriers || 0}</div>
          <div className="text-sm text-gray-500">Kurir Online</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <AlertTriangle size={20} className="text-orange-500 mb-1" />
          <div className="text-2xl font-bold">{data?.offlineQueueTotal || 0}</div>
          <div className="text-sm text-gray-500">Antrean Offline</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <CheckCircle size={20} className="text-emerald-500 mb-1" />
          <div className="text-2xl font-bold">{data?.avgSyncDelaySeconds || 0}s</div>
          <div className="text-sm text-gray-500">Rata-rata Delay</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <AlertTriangle size={20} className={`mb-1 ${(data?.stuckItems || 0) > 0 ? 'text-red-500' : 'text-emerald-500'}`} />
          <div className="text-2xl font-bold">{data?.stuckItems || 0}</div>
          <div className="text-sm text-gray-500">Item Tersangkut</div>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <h2 className="font-semibold mb-3">Detail Kurir</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500"><th>Nama</th><th>Status</th><th>Antrean</th><th>Sync Terakhir</th></tr></thead>
          <tbody>
            {(data?.couriers || []).map((c) => (
              <tr key={c.id} className="border-t">
                <td className="py-2">{c.name}</td>
                <td className="py-2"><span className={`px-2 py-0.5 rounded text-xs ${c.status === 'online' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>{c.status}</span></td>
                <td className="py-2">{c.queueSize}</td>
                <td className="py-2 text-gray-500">{c.lastSyncAt?.slice(0, 19) || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
