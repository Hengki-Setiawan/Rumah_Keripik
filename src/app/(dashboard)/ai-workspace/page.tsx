import { getModelRouterSettings } from '@/actions/ai-ops';
import { AiMonitorPanel } from '@/components/dashboard/AiMonitorPanel';
import { AiSkillsPanel } from '@/components/dashboard/AiSkillsPanel';
import { AiWorkspaceTabs } from '@/components/dashboard/AiWorkspaceTabs';
import { ModelRouterClient } from '@/components/dashboard/ModelRouterClient';
import { ModelRouterHealthPanel } from '@/components/dashboard/ModelRouterHealthPanel';
import { InfoButton } from '@/components/ui/InfoButton';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AiWorkspacePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams;
  const tab = params.tab === 'monitor' || params.tab === 'skills' || params.tab === 'router' ? params.tab : 'kb';
  const routerSettings = tab === 'router' ? await getModelRouterSettings() : null;

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-outline-variant bg-gradient-to-br from-white via-surface-container-lowest to-surface-cream p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-primary">Unified Control Center</p>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-on-surface md:text-4xl">Knowledge Base & AI</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">Kelola knowledge base, pantau performa AI, audit skills, dan atur model router tanpa berpindah menu. Route lama tetap aktif untuk deep link, tetapi navigasi utama sekarang fokus ke halaman ini.</p>
          </div>
          <InfoButton title="Knowledge Base & AI" description="Halaman ini menggabungkan Knowledge Base, AI Monitor, AI Skills, dan Model Router agar workspace dashboard lebih ringkas." usage="Mulai dari Knowledge Base untuk isi pengetahuan, cek Monitor untuk error/fallback, lihat Skills untuk kemampuan aktif, lalu ubah Router jika perlu mengganti provider AI." />
        </div>
      </div>

      <AiWorkspaceTabs activeTab={tab} />

      {tab === 'kb' && <KnowledgeBaseBridge />}
      {tab === 'monitor' && <AiMonitorPanel compactHeader />}
      {tab === 'skills' && <AiSkillsPanel compactHeader />}
      {tab === 'router' && routerSettings && <div className="space-y-6"><ModelRouterHealthPanel /><ModelRouterClient compactHeader providerConfigs={routerSettings.providerConfigs} taskConfigs={routerSettings.taskConfigs} /></div>}
    </div>
  );
}

function KnowledgeBaseBridge() {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Knowledge Base, Rule, Log & Analytics</h2>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">CRUD Knowledge Base dan pengaturan auto-reply sudah stabil di modul pengaturan asisten AI. Modul ini tetap dipakai supaya semua fungsi tambah, hapus, toggle, log, analytics, dan public prompts tidak berubah.</p>
          </div>
          <InfoButton title="Knowledge Base" description="Database pengetahuan yang dipakai AI untuk menjawab FAQ, produk, pengiriman, kebijakan, dan fallback." usage="Klik buka modul lengkap, pilih tab AI Knowledge Base, tambah dokumen, lalu gunakan Conversation Log dan Analytics untuk audit hasilnya." />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/bot-config?tab=kb" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary">Buka CRUD Knowledge Base</Link>
          <Link href="/bot-config?tab=rules" className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container">Auto Reply Rules</Link>
          <Link href="/bot-config?tab=logs" className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container">Conversation Log</Link>
          <Link href="/bot-config?tab=analytics" className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container">Analytics</Link>
        </div>
      </section>
      <section className="rounded-3xl border border-outline-variant bg-white p-6 shadow-sm">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Alur Pakai Cepat</h2>
        <div className="mt-4 space-y-3 text-sm text-on-surface-variant">
          <Step number="1" title="Tambah pengetahuan" text="Masukkan FAQ, produk, pembayaran, atau pengiriman ke Knowledge Base." />
          <Step number="2" title="Pantau kualitas" text="Buka AI Monitor untuk melihat error, fallback, token, latency, dan feedback gagal." />
          <Step number="3" title="Optimalkan routing" text="Jika provider lambat/error, ubah prioritas dan fallback di Model Router." />
        </div>
      </section>
    </div>
  );
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="rounded-2xl bg-surface-cream p-4"><div className="flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-bold text-on-primary">{number}</span><p className="font-semibold text-on-surface">{title}</p></div><p className="mt-2 leading-6">{text}</p></div>;
}
