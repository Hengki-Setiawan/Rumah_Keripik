'use client';

import { useState, useTransition } from 'react';
import { Activity, RefreshCw } from 'lucide-react';

type HealthCheck = { provider: string; model: string; enabled: boolean; hasKey: boolean; ok: boolean; latencyMs: number; status: string; error?: string };

export function ModelRouterHealthPanel() {
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [message, setMessage] = useState('Belum dites. Jalankan sebelum production.');
  const [pending, startTransition] = useTransition();

  function runHealth() {
    startTransition(async () => {
      setMessage('Mengetes provider...');
      const res = await fetch('/api/admin/model-router/health');
      const data = await res.json();
      setChecks(data.checks || []);
      setMessage(data.ok ? 'Minimal satu provider siap.' : data.error || 'Tidak ada provider sehat.');
    });
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-surface-container-lowest p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div><h2 className="font-headline-sm text-headline-sm text-on-surface">Provider Health Check</h2><p className="mt-1 text-sm text-on-surface-variant">Cek API key, fallback, latency, dan provider aktif sebelum production.</p></div>
        <button onClick={runHealth} disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-bold text-on-primary disabled:opacity-60"><RefreshCw size={16} /> Test Provider</button>
      </div>
      <p className="mt-3 rounded-lg bg-surface-cream p-3 text-sm font-bold text-on-surface-variant">{message}</p>
      {checks.length > 0 && <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{checks.map((check) => <div key={check.provider} className="rounded-lg border border-outline-variant/20 bg-white p-4"><div className="flex items-center justify-between gap-3"><p className="font-bold text-on-surface">{check.provider}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${check.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{check.status}</span></div><p className="mt-1 text-xs text-on-surface-variant">{check.model}</p><div className="mt-3 flex items-center gap-2 text-xs font-bold text-on-surface-variant"><Activity size={14} /> {check.latencyMs}ms • key {check.hasKey ? 'ada' : 'tidak ada'} • {check.enabled ? 'enabled' : 'disabled'}</div>{check.error && <p className="mt-2 line-clamp-2 text-xs text-red-700">{check.error}</p>}</div>)}</div>}
    </section>
  );
}
