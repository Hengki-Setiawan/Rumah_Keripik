'use client';

import { useState, useTransition } from 'react';
import { BrainCircuit, RefreshCcw, RotateCcw, TrendingUp } from 'lucide-react';

interface BanditArmRow {
  task: string;
  provider: string;
  pulls: number;
  expectedReward: number;
  rewardStd: number;
  successRate: number;
  latencyEmaMs: number;
  alpha: number;
  beta: number;
}

interface BanditData {
  config: {
    enabled: boolean;
    epsilon: number;
    weights: { success: number; latency: number; cost: number };
    minPullsBeforeExploit: number;
  };
  arms: BanditArmRow[];
}

export function BanditPanel({ compactHeader = false }: { compactHeader?: boolean }) {
  const [data, setData] = useState<BanditData | null>(null);
  const [message, setMessage] = useState('Belum dimuat. Tekan Muat untuk melihat posterior bandit.');
  const [epsilon, setEpsilon] = useState<number>(0.1);
  const [enabled, setEnabled] = useState(true);
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      setMessage('Memuat posterior bandit…');
      try {
        const res = await fetch('/api/admin/bandit');
        const json = await res.json();
        if (json.ok) {
          setData(json.data);
          setEpsilon(json.data.config.epsilon);
          setEnabled(json.data.config.enabled);
          setMessage(json.data.arms.length === 0 ? 'Belum ada arm dengan data. Setelah chat diproses, posterior akan muncul di sini.' : '');
        } else {
          setMessage(json.error || 'Gagal memuat state bandit.');
        }
      } catch {
        setMessage('Gagal terhubung ke API bandit.');
      }
    });
  }

  function saveConfig() {
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/bandit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: { enabled, epsilon } }),
        });
        const json = await res.json();
        if (json.ok) {
          setData((prev) => (prev ? { ...prev, config: json.data.config } : prev));
          setMessage('Konfigurasi bandit tersimpan.');
        } else {
          setMessage(json.error || 'Gagal menyimpan konfigurasi.');
        }
      } catch {
        setMessage('Gagal menyimpan konfigurasi.');
      }
    });
  }

  function reset() {
    if (!confirm('Hapus semua posterior bandit? Model akan bootstrap ulang dari riwayat ai_runs.')) return;
    startTransition(async () => {
      const res = await fetch('/api/admin/bandit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      const json = await res.json();
      setMessage(json.ok ? 'State bandit di-reset.' : json.error || 'Gagal reset.');
      if (json.ok) setData(null);
    });
  }

  const tasks = data ? [...new Set(data.arms.map((a) => a.task))].sort() : [];

  return (
    <section className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-container text-primary"><BrainCircuit size={22} /></div>
          <div>
            <h2 className={compactHeader ? 'font-headline-sm text-headline-sm text-on-surface' : 'font-headline-lg text-headline-lg text-on-surface'}>
              RL Bandit — Model Router
            </h2>
            <p className="text-sm text-on-surface-variant">
              Thompson sampling memilih provider terbaik per task lewat belajar dari reward (sukses, latency, biaya).
            </p>
          </div>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container">
          <RefreshCcw size={15} /> Muat ulang
        </button>
      </div>

      {message && (
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary-container/30 p-4 text-sm font-bold text-on-surface">{message}</div>
      )}

      {data && (
        <>
          <div className="mt-6 flex flex-wrap items-end gap-4 rounded-2xl bg-surface-cream p-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-on-surface">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-primary" />
              Aktif
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-on-surface">
              Epsilon (explore)
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={epsilon}
                onChange={(e) => setEpsilon(Number(e.target.value))}
                className="w-20 rounded-lg border border-outline-variant bg-white px-2 py-1 text-sm"
              />
            </label>
            <button onClick={saveConfig} disabled={pending} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary disabled:opacity-60">
              Simpan Konfigurasi
            </button>
            <button onClick={reset} disabled={pending} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-60">
              <RotateCcw size={14} /> Reset
            </button>
          </div>

          {tasks.length === 0 && (
            <p className="mt-6 text-sm text-on-surface-variant">
              Belum ada arm dengan data. Begitu model router melayani chat, posterior akan muncul di sini (bootstrap dari 30 hari riwayat ai_runs).
            </p>
          )}

          {tasks.map((task) => (
            <div key={task} className="mt-6">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">{task}</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.arms.filter((a) => a.task === task).map((arm) => (
                  <div key={`${task}-${arm.provider}`} className="rounded-2xl border border-outline-variant bg-white p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-on-surface">{arm.provider}</p>
                      <span className="rounded-md bg-surface-container px-2 py-0.5 text-xs font-semibold text-on-surface-variant">{arm.pulls} pulls</span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <TrendingUp size={15} className="text-primary" />
                      <span className="text-2xl font-semibold tracking-[-0.03em] text-on-surface">{Number(arm.expectedReward * 100).toFixed(0)}</span>
                      <span className="text-xs text-on-surface-variant">skor</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-container">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, arm.expectedReward * 100)}%` }} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-on-surface-variant">
                      <span>Sukses: {Number(arm.successRate * 100).toFixed(0)}%</span>
                      <span>Latensi: {arm.latencyEmaMs ? `${arm.latencyEmaMs}ms` : '—'}</span>
                      <span>α={Number(arm.alpha).toFixed(1)} β={Number(arm.beta).toFixed(1)}</span>
                      <span>σ={Number(arm.rewardStd).toFixed(3)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  );
}