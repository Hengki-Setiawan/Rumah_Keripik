'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, MapPin, MessageSquare, CheckCircle, Clock, X, User } from 'lucide-react';

interface Incident {
  id: number;
  courierId: number;
  courierName: string;
  courierPhone: string;
  lat: string;
  lng: string;
  message: string;
  status: string;
  responseNote: string;
  createdAt: string;
  resolvedAt: string | null;
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [responseNote, setResponseNote] = useState('');
  const [filter, setFilter] = useState('active');

  const fetchIncidents = () => {
    setLoading(true);
    fetch('/api/admin/incidents')
      .then((r) => r.json())
      .then((d) => { if (d.ok) setIncidents(d.data || []); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchIncidents(); }, []);

  const handleResolve = async (id: number) => {
    await fetch(`/api/admin/incidents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved', responseNote }),
    });
    setSelected(null);
    setResponseNote('');
    fetchIncidents();
  };

  const filtered = incidents.filter((i) => {
    if (filter === 'all') return true;
    return i.status === filter;
  });

  if (loading) return <div className="p-6 text-gray-500">Memuat data insiden...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><AlertTriangle /> Insiden & SOS</h1>
        <div className="flex gap-2">
          {['active', 'resolved', 'all'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm ${filter === s ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {s === 'active' ? 'Aktif' : s === 'resolved' ? 'Selesai' : 'Semua'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        {filtered.map((inc) => (
          <div
            key={inc.id}
            className={`bg-white rounded-lg shadow-sm border p-4 cursor-pointer hover:shadow-md transition ${inc.status === 'active' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-emerald-500'}`}
            onClick={() => { setSelected(inc); setResponseNote(''); }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <User size={14} className="text-gray-500" />
                  <span className="font-semibold">{inc.courierName || `Kurir #${inc.courierId}`}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    inc.status === 'active' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>{inc.status === 'active' ? 'AKTIF' : 'SELESAI'}</span>
                </div>
                {inc.message && (
                  <div className="flex items-start gap-1 text-sm text-gray-600 mb-1">
                    <MessageSquare size={14} className="mt-0.5 shrink-0" />
                    <span>{inc.message}</span>
                  </div>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Clock size={12} />{new Date(inc.createdAt).toLocaleString('id-ID')}</span>
                  <span className="flex items-center gap-1">{inc.courierPhone}</span>
                </div>
              </div>
              <MapPin size={20} className="text-red-400 shrink-0" />
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-gray-400 py-10">Tidak ada insiden</div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={20} />
                Detail Insiden #{selected.id}
              </h3>
              <button onClick={() => setSelected(null)}><X size={20} /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div><span className="text-gray-500">Kurir:</span> {selected.courierName || `#${selected.courierId}`}</div>
              <div><span className="text-gray-500">Telepon:</span> {selected.courierPhone || '-'}</div>
              <div><span className="text-gray-500">Pesan:</span> {selected.message || '-'}</div>
              <div><span className="text-gray-500">Lokasi:</span> {selected.lat}, {selected.lng}</div>
              <div><span className="text-gray-500">Status:</span> {selected.status}</div>
              <div><span className="text-gray-500">Dibuat:</span> {new Date(selected.createdAt).toLocaleString('id-ID')}</div>
              {selected.resolvedAt && (
                <div><span className="text-gray-500">Selesai:</span> {new Date(selected.resolvedAt).toLocaleString('id-ID')}</div>
              )}
              {selected.status === 'active' && (
                <div className="pt-3 border-t">
                  <label className="block text-sm font-medium mb-1">Catatan Respon</label>
                  <textarea
                    className="w-full border rounded-lg p-2 text-sm"
                    rows={3}
                    value={responseNote}
                    onChange={(e) => setResponseNote(e.target.value)}
                    placeholder="Catat tindakan yang diambil..."
                  />
                  <button
                    onClick={() => handleResolve(selected.id)}
                    className="mt-2 w-full flex items-center justify-center gap-1 bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600"
                  >
                    <CheckCircle size={16} /> Tandai Selesai
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
