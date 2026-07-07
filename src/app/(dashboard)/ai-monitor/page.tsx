import { Activity, AlertTriangle, Bot, GitBranch, PackageCheck, Sparkles, Timer, Wrench } from 'lucide-react';
import { getAiMonitorData } from '@/actions/ai-ops';

export const dynamic = 'force-dynamic';

export default async function AiMonitorPage() {
  const data = await getAiMonitorData();
  const stats = data.stats || { totalRuns: 0, fallbackRuns: 0, errorRuns: 0, totalOutputTokens: 0, avgLatencyMs: 0 };
  const errorRate = Number(stats.totalRuns || 0) > 0 ? Math.round((Number(stats.errorRuns || 0) / Number(stats.totalRuns || 1)) * 100) : 0;
  const fallbackRate = Number(stats.totalRuns || 0) > 0 ? Math.round((Number(stats.fallbackRuns || 0) / Number(stats.totalRuns || 1)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div><h1 className="font-headline-lg text-headline-lg text-on-surface">AI Monitor</h1><p className="mt-1 text-on-surface-variant">Observability AI: provider, token, latency, fallback, tool calls, feedback gagal, dan conversion dari chat.</p></div>
      <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-8">
        <Metric icon={<Bot size={20} />} label="AI Runs" value={stats.totalRuns || 0} />
        <Metric icon={<Activity size={20} />} label="Fallback" value={`${fallbackRate}%`} />
        <Metric icon={<AlertTriangle size={20} />} label="Error Rate" value={`${errorRate}%`} />
        <Metric icon={<Timer size={20} />} label="Avg Latency" value={`${Math.round(Number(stats.avgLatencyMs || 0))}ms`} />
        <Metric icon={<Wrench size={20} />} label="Output Token" value={stats.totalOutputTokens || 0} />
        <Metric icon={<PackageCheck size={20} />} label="Chat Orders" value={data.chatOrderStats?.total || 0} />
        <Metric icon={<Sparkles size={20} />} label="Rekomendasi" value={sumTotals(data.recommendationStats)} />
        <Metric icon={<GitBranch size={20} />} label="Learning" value={data.learningEvents.length} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Breakdown title="Provider Breakdown" rows={data.providerBreakdown.map((row) => ({ label: row.provider, value: `${row.total} run • ${Math.round(Number(row.avgLatencyMs || 0))}ms • ${row.errors || 0} error` }))} />
        <Breakdown title="Task Breakdown" rows={data.taskBreakdown.map((row) => ({ label: row.task, value: `${row.total} run • ${row.fallback || 0} fallback` }))} />
        <Breakdown title="Recommendation Funnel" rows={data.recommendationStats.map((row) => ({ label: row.eventType, value: `${row.total} event` }))} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest"><Header title="AI Runs Terbaru" subtitle="80 run terakhir" /><div className="max-h-[520px] overflow-auto"><table className="w-full text-xs"><thead className="bg-surface-container text-on-surface-variant"><tr><th className="px-3 py-2 text-left">Waktu</th><th className="px-3 py-2 text-left">Task</th><th className="px-3 py-2 text-left">Provider</th><th className="px-3 py-2 text-right">Token</th><th className="px-3 py-2 text-right">Latency</th><th className="px-3 py-2 text-left">Status</th></tr></thead><tbody className="divide-y divide-outline-variant/10">{data.runs.map((run) => <tr key={run.id}><td className="px-3 py-2">{formatDate(run.createdAt)}</td><td className="px-3 py-2 font-semibold">{run.task}</td><td className="px-3 py-2">{run.provider}<br /><span className="text-on-surface-variant">{run.model}</span></td><td className="px-3 py-2 text-right">{run.outputTokens}</td><td className="px-3 py-2 text-right">{run.latencyMs || 0}ms</td><td className="px-3 py-2"><Badge value={run.status} /></td></tr>)}</tbody></table></div></section>
        <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest"><Header title="Tool Calls" subtitle="Tool registry audit" /><div className="max-h-[520px] overflow-auto"><table className="w-full text-xs"><thead className="bg-surface-container text-on-surface-variant"><tr><th className="px-3 py-2 text-left">Waktu</th><th className="px-3 py-2 text-left">Tool</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-right">Latency</th></tr></thead><tbody className="divide-y divide-outline-variant/10">{data.toolCalls.map((call) => <tr key={call.id}><td className="px-3 py-2">{formatDate(call.createdAt)}</td><td className="px-3 py-2 font-semibold">{call.toolName}</td><td className="px-3 py-2"><Badge value={call.status} /></td><td className="px-3 py-2 text-right">{call.latencyMs || 0}ms</td></tr>)}</tbody></table></div></section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest"><Header title="Learning Events" subtitle="Event aman untuk evaluasi dan rekomendasi" /><div className="max-h-[420px] divide-y divide-outline-variant/10 overflow-auto">{data.learningEvents.map((item) => <div key={item.id} className="p-4"><div className="flex flex-wrap items-center gap-2"><Badge value={item.eventType} /><span className="text-xs text-on-surface-variant">{formatDate(item.createdAt)}</span>{item.intent ? <span className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-medium text-on-surface-variant">{item.intent}</span> : null}</div><p className="mt-2 text-sm font-medium text-on-surface">Outcome: {item.outcome || '-'}</p></div>)}{data.learningEvents.length === 0 && <div className="p-8 text-center text-sm text-on-surface-variant">Belum ada learning event.</div>}</div></section>
        <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest"><Header title="Feedback / Failed Conversations" subtitle="Low confidence, invalid JSON, provider error, dan issue lain" /><div className="max-h-[420px] divide-y divide-outline-variant/10 overflow-auto">{data.failed.map((item) => <div key={item.id} className="p-4"><div className="flex flex-wrap items-center gap-2"><Badge value={item.reason} /><span className="text-xs text-on-surface-variant">{formatDate(item.created_at)}</span>{item.resolved ? <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">RESOLVED</span> : null}</div><p className="mt-2 font-semibold text-on-surface">{item.user_message}</p>{item.raw_ai_output && <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant">{item.raw_ai_output}</p>}</div>)}</div></section>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) { return <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container text-primary">{icon}</div><p className="text-sm text-on-surface-variant">{label}</p><p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-on-surface">{value}</p></div>; }
function Header({ title, subtitle }: { title: string; subtitle: string }) { return <div className="border-b border-outline-variant/20 p-4"><h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2><p className="text-sm text-on-surface-variant">{subtitle}</p></div>; }
function Badge({ value }: { value: string }) { const good = value === 'success' || value === 'answered' || value === 'shown' || value === 'ordered'; return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${good ? 'bg-green-50 text-green-700' : value === 'fallback' ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700'}`}>{value}</span>; }
function Breakdown({ title, rows }: { title: string; rows: Array<{ label: string; value: string }> }) { return <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5"><h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2><div className="mt-4 space-y-2">{rows.map((row) => <div key={row.label} className="flex justify-between gap-3 rounded-lg bg-surface-cream px-3 py-2 text-sm"><span className="font-semibold text-on-surface">{row.label}</span><span className="text-right text-on-surface-variant">{row.value}</span></div>)}{rows.length === 0 && <p className="text-sm text-on-surface-variant">Belum ada data.</p>}</div></section>; }
function sumTotals(rows: Array<{ total: number }>) { return rows.reduce((sum, row) => sum + Number(row.total || 0), 0); }
function formatDate(value: string) { return new Date(`${value.endsWith('Z') ? value : `${value}Z`}`).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }); }
