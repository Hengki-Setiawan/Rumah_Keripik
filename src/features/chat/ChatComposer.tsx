'use client';

import { FormEvent, useState } from 'react';
import { Loader2, Plus, SendHorizonal, Sparkles } from 'lucide-react';

export function ChatComposer({
  disabled,
  onSend,
}: {
  disabled?: boolean;
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
      className="rounded-[1.9rem] border border-[#eadfce] bg-[rgba(255,251,245,0.88)] p-2 shadow-[0_24px_70px_rgba(47,36,28,0.12)] backdrop-blur-2xl transition focus-within:border-[#dbc7af] focus-within:shadow-[0_28px_80px_rgba(47,36,28,0.14)]"
    >
      <div className="flex items-end gap-2">
        <button
          type="button"
          aria-label="Lampirkan atau tambah konteks"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#6f5d4f] transition hover:bg-[#f3ebdc] hover:text-[#2f241c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4423]/15"
        >
          <Plus size={20} />
        </button>

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
            className="max-h-40 min-h-12 w-full resize-none bg-transparent px-1 py-3 text-[15px] leading-7 text-[#2f241c] outline-none placeholder:text-[#9b8772]"
          />
          <div className="flex items-center justify-between gap-3 px-1 pb-1">
            <div className="hidden items-center gap-2 text-[11px] font-medium text-[#8a7562] sm:inline-flex">
              <Sparkles size={12} className="text-[#7a963a]" />
              AI bantu pilih rasa, stok, dan checkout lebih cepat
            </div>
            <div className="ml-auto text-[11px] text-[#9b8772]">
              `Enter` kirim, `Shift + Enter` baris baru
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={disabled || !message.trim()}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#111111] text-white shadow-[0_14px_34px_rgba(17,17,17,0.18)] transition hover:scale-[1.02] hover:bg-[#222222] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]/20 disabled:cursor-not-allowed disabled:bg-[#cec2b2] disabled:shadow-none"
          aria-label="Kirim pesan"
        >
          {disabled ? <Loader2 size={18} className="animate-spin" /> : <SendHorizonal size={18} />}
        </button>
      </div>
    </form>
  );
}
