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
    <form onSubmit={submit} className="flex items-end gap-3 rounded-[1.6rem] border border-[#e7c88c] bg-white p-2 shadow-xl shadow-[#8d4b00]/10">
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
        placeholder="Tulis kebutuhanmu, contoh: keripik buat keluarga budget 100 ribu..."
        className="max-h-32 min-h-12 flex-1 resize-none rounded-[1.2rem] bg-[#fff8e8] px-4 py-3 text-sm font-semibold text-[#2a1606] outline-none placeholder:text-[#8c6a4c]"
      />
      <button
        type="submit"
        disabled={disabled || !message.trim()}
        className="grid h-12 w-12 shrink-0 place-items-center rounded-[1.1rem] bg-[#2a1606] text-white transition hover:bg-[#6f3900] disabled:cursor-not-allowed disabled:bg-[#c9b9a3]"
        aria-label="Kirim pesan"
      >
        {disabled ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
      </button>
    </form>
  );
}
