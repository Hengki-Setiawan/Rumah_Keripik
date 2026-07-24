'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle2, MapPin, Phone, RefreshCw, Clock } from 'lucide-react';

interface SosEvent {
  id: number;
  courierId: number;
  courierName: string | null;
  courierPhone: string | null;
  lat: string;
  lng: string;
  message: string | null;
  status: 'active' | 'resolved';
  resolvedAt: string | null;
  resolvedBy: string | null;
  note: string | null;
  createdAt: string;
}

export default function SosDashboardPage() {
  const [events, setEvents] = useState<SosEvent[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/sos');
    const json = await res.json();
    if (json.ok) setEvents(json.events);
    setLoading(false);
  }

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  async function resolve(id: number) {
    await fetch('/api/admin/sos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, note: 'Resolved by admin' }) });
    load();
  }

  async function openMaps(lat: string, lng: string) {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  }

  const activeEvents = events.filter((e) => e.status === 'active');
  const resolvedEvents = events.filter((e) => e.status === 'resolved');

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2f241c] flex items-center gap-2">
            <ShieldAlert className="text-red-600" size={24} />
            SOS Darurat
          </h1>
          <p className="text-sm text-[#776454] mt-1">Pantau sinyal darurat dari kurir</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 rounded-xl bg-[#f0dfca] px-4 py-2 text-sm font-medium text-[#2f241c] hover:bg-[#e5d0b8] transition">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {activeEvents.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="font-bold text-red-800 flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-red-600 animate-pulse" />
            {activeEvents.length} sinyal aktif
          </p>
        </div>
      )}

      <div className="space-y-3">
        {loading && events.length === 0 ? (
          <p className="text-center text-[#776454] py-12">Memuat...</p>
        ) : events.length === 0 ? (
          <p className="text-center text-[#776454] py-12">Belum ada sinyal darurat</p>
        ) : (
          events.map((event) => (
            <div key={event.id} className={`rounded-2xl border p-4 transition ${
              event.status === 'active' ? 'border-red-300 bg-white shadow-md' : 'border-[#f0dfca] bg-[#faf6ef] opacity-60'
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-block h-2 w-2 rounded-full ${event.status === 'active' ? 'bg-red-600 animate-pulse' : 'bg-gray-400'}`} />
                    <span className="font-semibold text-[#2f241c]">{event.courierName || 'Kurir #' + event.courierId}</span>
                    {event.courierPhone && (
                      <a href={`tel:${event.courierPhone}`} className="text-[#c55a2b] hover:underline text-sm flex items-center gap-1">
                        <Phone size={12} /> {event.courierPhone}
                      </a>
                    )}
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                      event.status === 'active' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {event.status === 'active' ? 'AKTIF' : 'SELESAI'}
                    </span>
                  </div>

                  {event.message && (
                    <p className="text-sm text-[#776454] mt-1 ml-4">{event.message}</p>
                  )}

                  <div className="flex items-center gap-4 mt-2 ml-4 text-xs text-[#776454]">
                    <span className="flex items-center gap-1"><MapPin size={10} /> {event.lat}, {event.lng}</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {new Date(event.createdAt).toLocaleString('id-ID')}</span>
                  </div>

                  {event.note && (
                    <p className="text-xs text-[#776454] mt-1 ml-4 italic">Catatan: {event.note}</p>
                  )}
                </div>

                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openMaps(event.lat, event.lng)}
                    className="rounded-xl bg-[#f0dfca] px-3 py-2 text-xs font-medium hover:bg-[#e5d0b8] transition">
                    <MapPin size={14} />
                  </button>
                  {event.status === 'active' && (
                    <button onClick={() => resolve(event.id)}
                      className="rounded-xl bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 transition flex items-center gap-1">
                      <CheckCircle2 size={14} /> Selesai
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
