'use client';

import { useMemo, useState, useTransition } from 'react';
import { AlertTriangle, CheckCircle2, Save } from 'lucide-react';
import { saveModelRouterSettings } from '@/actions/ai-ops';

export function ModelRouterClient({ providerConfigs, taskConfigs, compactHeader = false }: { providerConfigs: unknown; taskConfigs: unknown; compactHeader?: boolean }) {
  const [providerText, setProviderText] = useState(JSON.stringify(providerConfigs, null, 2));
  const [taskText, setTaskText] = useState(JSON.stringify(taskConfigs, null, 2));
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const providerPreview = useMemo(() => parseArray(providerText), [providerText]);
  const taskPreview = useMemo(() => parseArray(taskText), [taskText]);
  const valid = providerPreview.ok && taskPreview.ok;

  function save() {
    if (!valid) {
      setMessage('JSON belum valid. Perbaiki config sebelum menyimpan.');
      return;
    }
    startTransition(async () => {
      const res = await saveModelRouterSettings({ providerConfigsJson: providerText, taskConfigsJson: taskText });
      setMessage(res.ok ? 'Konfigurasi model router tersimpan.' : res.error || 'Gagal menyimpan config.');
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>{compactHeader ? <h2 className="font-headline-sm text-headline-sm text-on-surface">Model Router</h2> : <h1 className="font-headline-lg text-headline-lg text-on-surface">Model Router</h1>}<p className="mt-1 text-on-surface-variant">Atur strategi AI per beban kerja: Gemini untuk tugas berat, Cerebras untuk tugas menengah, dan Groq untuk tugas cepat. Fallback tetap berlapis sampai deterministic.</p></div>
        <button onClick={save} disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-bold text-on-primary disabled:opacity-60"><Save size={16} /> Simpan</button>
      </div>
      {message && <div className="rounded-xl border border-primary/20 bg-primary-container/30 p-4 text-sm font-bold text-on-surface">{message}</div>}

      <div className="grid gap-4 xl:grid-cols-2">
        <Preview title="Provider Health" ok={providerPreview.ok} error={providerPreview.error} rows={providerPreview.rows.map((row) => ({ label: `${row.name || row.id}${row.enabled ? '' : ' (off)'}`, value: `${row.defaultModel || '-'} • ${row.supportsStructuredOutput ? 'JSON' : 'text'} • ${row.supportsToolCalling ? 'tools' : 'no tools'} • priority ${row.priority ?? '-'}` }))} />
        <Preview title="Task Routing" ok={taskPreview.ok} error={taskPreview.error} rows={taskPreview.rows.map((row) => ({ label: row.task || 'task', value: `${row.primaryProviderId || '-'} → ${(row.fallbackProviderIds || []).join(' → ') || '-'} • ${row.maxOutputTokens || '-'} token • ${row.timeoutMs || '-'}ms` }))} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-neutral-200 bg-surface-container-lowest p-5 shadow-sm"><h2 className="font-headline-sm text-headline-sm text-on-surface">Provider Config</h2><p className="mb-3 mt-1 text-sm text-on-surface-variant">enabled, env key, capability, model, priority.</p><textarea value={providerText} onChange={(event) => setProviderText(event.target.value)} className="h-[560px] w-full rounded-lg border border-outline-variant bg-surface-cream p-4 font-mono text-xs outline-none focus:border-primary" /></section>
        <section className="rounded-xl border border-neutral-200 bg-surface-container-lowest p-5 shadow-sm"><h2 className="font-headline-sm text-headline-sm text-on-surface">Task Routing Config</h2><p className="mb-3 mt-1 text-sm text-on-surface-variant">primary/fallback provider per task, token limit, timeout.</p><textarea value={taskText} onChange={(event) => setTaskText(event.target.value)} className="h-[560px] w-full rounded-lg border border-outline-variant bg-surface-cream p-4 font-mono text-xs outline-none focus:border-primary" /></section>
      </div>
    </div>
  );
}

function Preview({ title, ok, error, rows }: { title: string; ok: boolean; error?: string; rows: Array<{ label: string; value: string }> }) {
  return <section className="rounded-xl border border-neutral-200 bg-surface-container-lowest p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>{ok ? <CheckCircle2 className="text-green-600" size={20} /> : <AlertTriangle className="text-red-600" size={20} />}</div>{error && <p className="mt-2 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}<div className="mt-4 space-y-2">{rows.map((row) => <div key={row.label} className="rounded-lg bg-surface-cream px-3 py-2 text-sm"><p className="font-bold text-on-surface">{row.label}</p><p className="text-xs text-on-surface-variant">{row.value}</p></div>)}{rows.length === 0 && ok && <p className="text-sm text-on-surface-variant">Config kosong.</p>}</div></section>;
}

function parseArray(value: string): { ok: boolean; rows: Array<Record<string, unknown>>; error?: string } {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return { ok: false, rows: [], error: 'Config harus berupa array JSON.' };
    return { ok: true, rows: parsed };
  } catch (error) {
    return { ok: false, rows: [], error: error instanceof Error ? error.message : 'JSON tidak valid' };
  }
}
