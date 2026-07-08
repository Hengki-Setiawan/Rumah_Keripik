'use client';

import { FormEvent, useState } from 'react';
import { Loader2, SendHorizonal, Sparkles } from 'lucide-react';

export function ChatComposer({
  disabled,
  idle = false,
  onSend,
}: {
  disabled?: boolean;
  idle?: boolean;
  onSend: (message: string) => Promise<void> | void;
}) {
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text || disabled) return;
    setMessage('');
    await onSend(text);
  }

  return (
    <form
      onSubmit={submit}
      className={`rounded-[1.5rem] border border-[#f0dfca] bg-[rgba(255,250,244,0.92)] p-1.5 shadow-[0_18px_54px_rgba(47,36,28,0.1)] backdrop-blur-2xl transition focus-within:border-[#e0c5a8] focus-within:shadow-[0_22px_66px_rgba(47,36,28,0.12)] md:rounded-[1.7rem] ${
        idle ? 'scale-100' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#c55a2b] md:h-10 md:w-10">
          <Sparkles size={16} />
        </span>

        <div className="min-w-0 flex-1">
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
            className="max-h-32 min-h-10 w-full resize-none bg-transparent px-1 py-2.5 text-[14px] leading-6 text-[#2f241c] outline-none placeholder:text-[#9b8772]"
          />
        </div>

        <button
          type="submit"
          disabled={disabled || !message.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#c55a2b] text-white shadow-[0_12px_28px_rgba(197,90,43,0.16)] transition hover:scale-[1.02] hover:bg-[#ae4d23] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c55a2b]/20 disabled:cursor-not-allowed disabled:bg-[#d8c8b8] disabled:shadow-none md:h-11 md:w-11"
          aria-label="Kirim pesan"
        >
          {disabled ? <Loader2 size={17} className="animate-spin" /> : <SendHorizonal size={17} />}
        </button>
      </div>
    </form>
  );
}
