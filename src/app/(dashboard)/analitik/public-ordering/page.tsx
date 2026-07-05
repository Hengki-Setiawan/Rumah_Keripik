'use client';

import { useEffect, useState } from 'react';

type FunnelRow = { eventType: string; count: number; conversionFromPrevious: number | null };
type Operations = {
  summary: {
    orders30d: number;
    paymentProofs: { pending: number; accepted: number; rejected: number };
    ocrJobs: { pending: number; failed: number };
  };
  recentEvents: Array<{ eventType: string; payload: string | null; createdAt: string }>;
};

export default function PublicOrderingAnalyticsPage() {
  const [funnel, setFunnel] = useState<FunnelRow[]>([]);
  const [ops, setOps] = useState<Operations | null>(null);
  const [message, setMessage] = useState('Memuat analytics...');

  useEffect(() => {
    async function load() {
      try {
        const [funnelRes, opsRes] = await Promise.all([
          fetch('/api/analytics/public-order-funnel'),
          fetch('/api/analytics/public-order-operations'),
        ]);
        const funnelData = await funnelRes.json();
        const opsData = await opsRes.json();
        setFunnel(funnelData.funnel || []);
        setOps(opsData.ok ? opsData : null);
        setMessage('');
      } catch {
        setMessage('Gagal memuat analytics public ordering.');
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Public Ordering Analytics</h1>
        <p className="text-on-surface-variant">Funnel /pesan, payment proof, OCR queue, dan event operasional 30 hari terakhir.</p>
      </div>
      {message && <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-700">{message}</p>}

      {ops && (
        <section className="grid gap-3 md:grid-cols-4">
          <Metric label="Order 30 hari" value={ops.summary.orders30d} />
          <Metric label="Proof pending" value={ops.summary.paymentProofs.pending} />
          <Metric label="Proof accepted" value={ops.summary.paymentProofs.accepted} />
          <Metric label="OCR issue" value={ops.summary.ocrJobs.pending + ops.summary.ocrJobs.failed} />
        </section>
      )}

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black">Funnel /pesan</h2>
        <div className="mt-4 space-y-3">
          {funnel.map((row) => (
            <div key={row.eventType} className="grid gap-3 rounded-xl bg-neutral-50 p-3 text-sm md:grid-cols-[240px_1fr_90px] md:items-center">
              <p className="font-black">{row.eventType.replace(/_/g, ' ')}</p>
              <div className="h-3 overflow-hidden rounded-full bg-neutral-200">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, row.count * 8)}%` }} />
              </div>
              <p className="text-right font-black">{row.count}</p>
              <p className="text-xs text-on-surface-variant md:col-span-3">Conversion dari step sebelumnya: {row.conversionFromPrevious == null ? '-' : `${row.conversionFromPrevious}%`}</p>
            </div>
          ))}
          {funnel.length === 0 && <p className="text-on-surface-variant">Belum ada event funnel.</p>}
        </div>
      </section>

      {ops && (
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">Recent Operational Events</h2>
          <div className="mt-4 space-y-2">
            {ops.recentEvents.map((event) => (
              <div key={`${event.eventType}-${event.createdAt}`} className="rounded-xl border p-3 text-sm">
                <p className="font-black">{event.eventType.replace(/_/g, ' ')}</p>
                <p className="text-xs text-on-surface-variant">{new Date(event.createdAt).toLocaleString('id-ID')}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase text-on-surface-variant">{label}</p><p className="mt-2 text-3xl font-black text-primary">{value}</p></div>;
}
