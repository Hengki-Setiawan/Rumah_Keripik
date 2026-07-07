'use client';

import type { QuickRepliesComponent } from '@/lib/chat-v3/types';

export function QuickReplies({ component, onSend, onAction }: { component: QuickRepliesComponent; onSend: (message: string) => void; onAction: (action: string, payload?: Record<string, unknown>) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {component.options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => option.action === 'send_message' ? onSend(option.value) : onAction(option.value, {})}
          className="rounded-full border border-[#f0dfca] bg-[rgba(255,250,244,0.88)] px-4 py-2.5 text-sm font-medium text-[#5f4d3f] shadow-[0_10px_24px_rgba(47,36,28,0.04)] transition hover:-translate-y-0.5 hover:border-[#dfc5a8] hover:bg-white"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
