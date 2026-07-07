import { CheckCircle2, Lightbulb } from 'lucide-react';
import { createKnowledgeFromFailedConversation, getAiMonitorData, resolveFailedConversation } from '@/actions/ai-ops';

export const dynamic = 'force-dynamic';

export default async function FeedbackLearningPage() {
  const data = await getAiMonitorData();
  return (
    <div className="space-y-6">
      <div><h1 className="font-headline-lg text-headline-lg text-on-surface">Feedback Learning</h1><p className="mt-1 text-on-surface-variant">Tempat AI “belajar” secara aman: review chat gagal lalu ubah menjadi KB/rule secara manual.</p></div>
      <div className="rounded-xl border border-neutral-200 bg-surface-container-lowest shadow-sm">
        <div className="border-b border-outline-variant/20 p-4"><h2 className="font-headline-sm text-headline-sm text-on-surface">Antrian Review</h2><p className="text-sm text-on-surface-variant">Pertanyaan gagal, low-confidence, invalid JSON, atau provider error.</p></div>
        <div className="divide-y divide-outline-variant/10">
          {data.failed.map((item) => (
            <div key={item.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_260px]">
              <div><div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">{item.reason}</span>{item.resolved ? <span className="rounded bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">RESOLVED</span> : null}<span className="text-xs text-on-surface-variant">{formatDate(item.created_at)}</span></div><p className="font-bold text-on-surface">{item.user_message}</p>{item.raw_ai_output && <p className="mt-2 rounded-lg bg-surface-cream p-3 text-xs text-on-surface-variant">{item.raw_ai_output}</p>}<p className="mt-2 text-xs text-on-surface-variant">Saran: buat KB baru di Knowledge Base jika pertanyaan valid, atau tandai selesai jika noise.</p></div>
              <div className="flex flex-col justify-center gap-2"><form action={async () => { 'use server'; await createKnowledgeFromFailedConversation(item.id); }}><button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary"><Lightbulb size={15} /> Jadikan Draft KB</button></form><a href={`/bot-config?tab=kb&judul=${encodeURIComponent(`Feedback: ${item.reason}`)}&teks=${encodeURIComponent(item.user_message)}`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-bold text-primary">Edit Manual KB</a><form action={async () => { 'use server'; await resolveFailedConversation(item.id, 'Ditinjau dari Feedback Learning'); }}><button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface-variant"><CheckCircle2 size={15} /> Tandai selesai</button></form></div>
            </div>
          ))}
          {data.failed.length === 0 && <div className="p-10 text-center text-on-surface-variant">Belum ada feedback gagal.</div>}
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string) { return new Date(`${value.endsWith('Z') ? value : `${value}Z`}`).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }); }
