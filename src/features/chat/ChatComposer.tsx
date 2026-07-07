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
    <form onSubmit={submit} className="flex items-end gap-2 rounded-[1.6rem] border border-[#e8dcc9] bg-[#fffdf8] p-2 shadow-[0_12px_32px_rgba(47,36,28,0.08)] transition focus-within:border-[#d6bea6] focus-within:ring-2 focus-within:ring-[#6b4423]/5">
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
        className="max-h-32 min-h-12 flex-1 resize-none rounded-[1.2rem] bg-transparent px-4 py-3 text-[15px] text-[#2f241c] outline-none placeholder:text-[#a08973]"
      />
      <button
        type="submit"
        disabled={disabled || !message.trim()}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#6b4423] text-white transition hover:bg-[#7d5230] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4423]/20 disabled:cursor-not-allowed disabled:bg-[#cbb8a0]"
        aria-label="Kirim pesan"
      >
        {disabled ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
      </button>
    </form>
  );
}
