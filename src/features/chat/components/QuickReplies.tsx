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
          className="rounded-full border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-[#111827] shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:bg-[#f3f4f6] hover:border-[#d1d5db]"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
