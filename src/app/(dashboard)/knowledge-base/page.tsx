import Link from 'next/link';
import { BookOpen, MessageSquareText, Sparkles } from 'lucide-react';
import { KnowledgePlayground } from '@/components/dashboard/KnowledgePlayground';
import { KnowledgeV3QuickAdd } from '@/components/dashboard/KnowledgeV3QuickAdd';
import { getStatsKnowledgeBase } from '@/actions/knowledge-base';

export const dynamic = 'force-dynamic';

export default async function KnowledgeBasePage() {
  const stats = await getStatsKnowledgeBase();
  return (
    <div className="space-y-6">
      <div><h1 className="font-headline-lg text-headline-lg text-on-surface">Knowledge Base AI</h1><p className="mt-1 text-on-surface-variant">Otak toko untuk FAQ, aturan produk, pengiriman, pembayaran, persona, template, dan fallback.</p></div>
      <div className="grid gap-4 md:grid-cols-3"><Card icon={<BookOpen />} label="Total Chunks" value={stats.total} /><Card icon={<Sparkles />} label="Aktif" value={stats.aktif} /><Card icon={<MessageSquareText />} label="Embedded" value={stats.withEmbedding} /></div>
      <KnowledgeV3QuickAdd />
      <div className="rounded-xl border border-neutral-200 bg-surface-container-lowest p-6 shadow-sm"><h2 className="font-headline-sm text-headline-sm text-on-surface">Kelola Knowledge Base</h2><p className="mt-2 text-on-surface-variant">Pengelolaan KB saat ini memakai modul Knowledge Base & AI yang sudah ada, dengan kategori yang diperluas untuk Blueprint V3. Feedback Learning dapat mengirim admin ke modul ini untuk membuat KB/rule baru dari chat gagal.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/bot-config?tab=kb" className="rounded-lg bg-primary px-4 py-2 font-bold text-on-primary">Buka CRUD KB</Link><Link href="/feedback-learning" className="rounded-lg border border-outline-variant px-4 py-2 font-bold text-on-surface-variant">Review Feedback Learning</Link><Link href="/ai-monitor" className="rounded-lg border border-outline-variant px-4 py-2 font-bold text-on-surface-variant">AI Monitor</Link></div></div>
      <KnowledgePlayground />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{['FAQ', 'Product Rule', 'Shipping Rule', 'Payment Rule', 'Promo', 'Persona', 'Safety Rule', 'Fallback'].map((item) => <div key={item} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"><p className="font-bold text-on-surface">{item}</p><p className="mt-1 text-sm text-on-surface-variant">Kategori Blueprint V3</p></div>)}</div>
    </div>
  );
}

function Card({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <div className="rounded-xl border border-neutral-200 bg-surface-container-lowest p-5 shadow-sm"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container text-primary">{icon}</div><p className="text-sm text-on-surface-variant">{label}</p><p className="mt-1 text-3xl font-bold text-on-surface">{value}</p></div>; }
