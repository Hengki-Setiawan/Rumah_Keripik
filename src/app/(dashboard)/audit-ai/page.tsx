import { ShieldCheck } from 'lucide-react';
import { getAiAuditEvents } from '@/actions/ai-ops';

export const dynamic = 'force-dynamic';

export default async function AuditAiPage() {
  const { adminEvents, learningEvents } = await getAiAuditEvents();
  return (
    <div className="space-y-6">
      <div><h1 className="font-headline-lg text-headline-lg text-on-surface">Audit AI & Admin</h1><p className="mt-1 text-on-surface-variant">Jejak event penting untuk production: aksi admin Hub, order dari chat, rekomendasi, provider fallback, dan learning event.</p></div>
      <div className="grid gap-4 md:grid-cols-3"><Metric label="Admin Audit" value={adminEvents.length} /><Metric label="Learning Event" value={learningEvents.length} /><Metric label="Order Chat" value={learningEvents.filter((event) => event.eventType === 'chat_order_created').length} /></div>
      <section className="rounded-xl border border-neutral-200 bg-surface-container-lowest shadow-sm">
        <div className="border-b border-outline-variant/20 p-4"><h2 className="font-headline-sm text-headline-sm text-on-surface">Admin Audit Log</h2><p className="text-sm text-on-surface-variant">Event admin dedicated dari `admin_audit_log`.</p></div>
        <div className="max-h-[420px] overflow-auto"><table className="w-full text-sm"><thead className="bg-surface-container text-xs text-on-surface-variant"><tr><th className="px-4 py-3 text-left">Waktu</th><th className="px-4 py-3 text-left">Actor</th><th className="px-4 py-3 text-left">Action</th><th className="px-4 py-3 text-left">Resource</th><th className="px-4 py-3 text-left">Metadata</th></tr></thead><tbody className="divide-y divide-outline-variant/10">{adminEvents.map((event) => <tr key={event.id}><td className="px-4 py-3 text-xs text-on-surface-variant">{formatDate(event.createdAt)}</td><td className="px-4 py-3 font-bold text-on-surface">{event.actor}</td><td className="px-4 py-3"><span className="inline-flex items-center gap-1 rounded bg-primary-container px-2 py-1 text-xs font-bold text-primary"><ShieldCheck size={12} /> {event.action}</span></td><td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{event.resourceType}:{event.resourceId || '-'}</td><td className="px-4 py-3"><pre className="max-w-sm overflow-hidden text-ellipsis whitespace-pre-wrap rounded bg-surface-cream p-2 text-[11px] text-on-surface-variant">{event.metadataJson || '-'}</pre></td></tr>)}</tbody></table></div>
      </section>
      <section className="rounded-xl border border-neutral-200 bg-surface-container-lowest shadow-sm">
        <div className="border-b border-outline-variant/20 p-4"><h2 className="font-headline-sm text-headline-sm text-on-surface">AI Learning Events</h2><p className="text-sm text-on-surface-variant">200 event terakhir dari `ai_learning_events`.</p></div>
        <div className="max-h-[420px] overflow-auto"><table className="w-full text-sm"><thead className="bg-surface-container text-xs text-on-surface-variant"><tr><th className="px-4 py-3 text-left">Waktu</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Outcome</th><th className="px-4 py-3 text-left">Intent</th><th className="px-4 py-3 text-left">Chat</th><th className="px-4 py-3 text-left">Metadata</th></tr></thead><tbody className="divide-y divide-outline-variant/10">{learningEvents.map((event) => <tr key={event.id}><td className="px-4 py-3 text-xs text-on-surface-variant">{formatDate(event.createdAt)}</td><td className="px-4 py-3"><span className="inline-flex items-center gap-1 rounded bg-primary-container px-2 py-1 text-xs font-bold text-primary"><ShieldCheck size={12} /> {event.eventType}</span></td><td className="px-4 py-3 font-bold text-on-surface">{event.outcome || '-'}</td><td className="px-4 py-3 text-on-surface-variant">{event.intent || '-'}</td><td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{event.chatSessionId || '-'}</td><td className="px-4 py-3"><pre className="max-w-sm overflow-hidden text-ellipsis whitespace-pre-wrap rounded bg-surface-cream p-2 text-[11px] text-on-surface-variant">{event.metadataJson || '-'}</pre></td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-neutral-200 bg-surface-container-lowest p-5 shadow-sm"><p className="text-sm text-on-surface-variant">{label}</p><p className="mt-1 text-3xl font-bold text-on-surface">{value}</p></div>; }
function formatDate(value: string) { return new Date(`${value.endsWith('Z') ? value : `${value}Z`}`).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }); }
