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
          className="rounded-full border border-[#e0bd82] bg-[#fff9ec] px-4 py-2 text-sm font-black text-[#7a3f00] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#ffe1aa]"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
