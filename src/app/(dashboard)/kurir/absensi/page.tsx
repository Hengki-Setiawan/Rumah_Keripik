'use client';

import { useState, useEffect, useCallback } from 'react';
import { CalendarCheck, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface AttendanceRow {
  id: number;
  courierId: number;
  courierName: string | null;
  courierPhone: string | null;
  shiftId: number | null;
  shiftTemplateName: string | null;
  clockInAt: string | null;
  clockInWithinGeofence: number | null;
  clockOutAt: string | null;
  clockOutWithinGeofence: number | null;
  totalWorkMinutes: number | null;
  status: string;
}

interface Summary {
  totalOpen: number;
  totalClosed: number;
  totalFlagged: number;
}

const statusBadge: Record<string, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'bg-amber-100 text-amber-700' },
  closed: { label: 'Closed', cls: 'bg-green-100 text-green-700' },
  flagged_late: { label: 'Telat', cls: 'bg-red-100 text-red-700' },
  flagged_early_leave: { label: 'Pulang Cepat', cls: 'bg-orange-100 text-orange-700' },
  flagged_no_geofence: { label: 'Luar Zona', cls: 'bg-purple-100 text-purple-700' },
};

function fmtTime(iso: string | null): string {
  if (!iso) return '–';
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '–';
  return iso.slice(0, 10);
}

export default function AbsensiPage() {
  const { addToast } = useToast();
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = date ? `?from=${date}&to=${date}` : '';
      const res = await fetch(`/api/admin/attendance${qs}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.attendance || []);
        setSummary(data.summary || null);
      }
    } catch {
      addToast('error', 'Gagal memuat absensi');
    }
    setLoading(false);
  }, [date, addToast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <CalendarCheck className="w-6 h-6 text-orange-600" />
          <h1 className="text-xl font-bold text-gray-800">Absensi Kurir</h1>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
          data-testid="absensi-date-input"
        />
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <div className="text-2xl font-bold text-amber-700">{summary.totalOpen}</div>
            <div className="text-sm text-amber-600">Masih Open</div>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-200 p-4">
            <div className="text-2xl font-bold text-green-700">{summary.totalClosed}</div>
            <div className="text-sm text-green-600">Closed</div>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-200 p-4">
            <div className="text-2xl font-bold text-red-700">{summary.totalFlagged}</div>
            <div className="text-sm text-red-600">Flagged</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3"><CardSkeleton /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Belum ada absensi untuk tanggal ini.</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left p-3 font-medium text-gray-600">Tanggal</th>
                <th className="text-left p-3 font-medium text-gray-600">Kurir</th>
                <th className="text-left p-3 font-medium text-gray-600">Shift</th>
                <th className="text-center p-3 font-medium text-gray-600">Masuk</th>
                <th className="text-center p-3 font-medium text-gray-600">Zona Masuk</th>
                <th className="text-center p-3 font-medium text-gray-600">Pulang</th>
                <th className="text-right p-3 font-medium text-gray-600">Durasi</th>
                <th className="text-center p-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const sb = statusBadge[r.status] || { label: r.status, cls: 'bg-gray-100 text-gray-600' };
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-3 text-gray-600 text-xs">{fmtDate(r.clockInAt)}</td>
                    <td className="p-3 font-medium">{r.courierName || `#${r.courierId}`}</td>
                    <td className="p-3 text-gray-600 text-xs">{r.shiftTemplateName || '–'}</td>
                    <td className="p-3 text-center font-mono text-xs">{fmtTime(r.clockInAt)}</td>
                    <td className="p-3 text-center">
                      {r.clockInWithinGeofence == null ? (
                        <span className="text-gray-300">–</span>
                      ) : r.clockInWithinGeofence === 1 ? (
                        <span className="text-green-600">✓</span>
                      ) : (
                        <span className="text-red-500">✗</span>
                      )}
                    </td>
                    <td className="p-3 text-center font-mono text-xs">{fmtTime(r.clockOutAt)}</td>
                    <td className="p-3 text-right">
                      {r.totalWorkMinutes != null ? (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                          <Clock className="w-3 h-3" />
                          {Math.floor(r.totalWorkMinutes / 60)}j {r.totalWorkMinutes % 60}m
                        </span>
                      ) : (
                        <span className="text-gray-300">–</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <Badge className={sb.cls}>{sb.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
