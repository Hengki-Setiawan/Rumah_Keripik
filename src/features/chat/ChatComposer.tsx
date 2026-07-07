'use client';

import { FormEvent, useState } from 'react';
import { Loader2, Send } from 'lucide-react';

export function ChatComposer({ disabled, onSend }: { disabled?: boolean; onSend: (message: string) => Promise<void> | void }) {
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text || disabled) return;
    setMessage('');
    await onSend(text);
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2 rounded-[1.6rem] border border-[#e5e7eb] bg-white p-2 shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition focus-within:border-[#cfd3d8] focus-within:ring-2 focus-within:ring-[#111827]/5">
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit(event as unknown as FormEvent);
          }
        }}
        rows={1}
        placeholder="Tanya stok, harga, atau tulis pesananmu..."
        className="max-h-32 min-h-12 flex-1 resize-none rounded-[1.2rem] bg-transparent px-4 py-3 text-[15px] text-[#111827] outline-none placeholder:text-[#9ca3af]"
      />
      <button
        type="submit"
        disabled={disabled || !message.trim()}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#111827] text-white transition hover:bg-[#374151] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]/20 disabled:cursor-not-allowed disabled:bg-[#d1d5db]"
        aria-label="Kirim pesan"
      >
        {disabled ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
      </button>
    </form>
  );
}
