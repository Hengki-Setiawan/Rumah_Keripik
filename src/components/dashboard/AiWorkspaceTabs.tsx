'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Activity, BookOpen, Bot, Brain, Route } from 'lucide-react';

const tabs = [
  { key: 'kb', label: 'Knowledge Base', href: '/ai-workspace?tab=kb', icon: BookOpen },
  { key: 'monitor', label: 'AI Monitor', href: '/ai-workspace?tab=monitor', icon: Activity },
  { key: 'skills', label: 'AI Skills', href: '/ai-workspace?tab=skills', icon: Brain },
  { key: 'router', label: 'Model Router', href: '/ai-workspace?tab=router', icon: Route },
];

export function AiWorkspaceTabs({ activeTab }: { activeTab: string }) {
  const searchParams = useSearchParams();
  const current = searchParams.get('tab') || activeTab;

  return (
    <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-3 shadow-sm">
      <div className="mb-3 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-on-primary"><Bot size={20} /></div>
        <div>
          <p className="text-sm font-semibold text-on-surface">AI Workspace</p>
          <p className="text-xs text-on-surface-variant">Semua kontrol AI dalam satu halaman</p>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = current === tab.key;
          return (
            <Link key={tab.key} href={tab.href} className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${active ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}>
              <Icon size={16} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
