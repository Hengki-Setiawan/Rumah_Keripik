'use client';

import { useEffect, useRef } from 'react';
import { PackageSearch, ShoppingBag, Sparkles } from 'lucide-react';
import type { ChatCartDto, ChatMessageDto } from '@/lib/chat-v3/types';
import { ChatMessage } from './ChatMessage';

export function ChatWindow({ messages, cart, loading, onSend, onAction }: { messages: ChatMessageDto[]; cart?: ChatCartDto | null; loading?: boolean; onSend: (message: string) => void; onAction: (action: string, payload?: Record<string, unknown>) => void }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, loading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        {!loading && messages.length === 0 && (
          <div className="flex min-h-[55vh] items-center justify-center">
            <div className="w-full max-w-2xl text-center">
              <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-[#111827] text-white shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
                <Sparkles size={22} />
              </div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[#111827] md:text-3xl">Mau pesan keripik apa hari ini?</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6b7280]">Tanya stok, harga, varian rasa, atau langsung buat pesanan. Aku bantu dari rekomendasi sampai checkout.</p>
              <div className="mt-8 grid gap-2 text-left sm:grid-cols-2">
                {[
                  { icon: <ShoppingBag size={17} />, label: 'Lihat menu best seller' },
                  { icon: <Sparkles size={17} />, label: 'Rekomendasi rasa pedas' },
                  { icon: <PackageSearch size={17} />, label: 'Cek status pesanan' },
                  { icon: <ShoppingBag size={17} />, label: 'Pesan untuk warung' },
                ].map((item) => (
                  <button key={item.label} type="button" onClick={() => onSend(item.label)} className="flex items-center gap-3 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm font-medium text-[#111827] shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:border-[#d1d5db] hover:bg-[#f7f7f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]/20">
                    <span className="text-[#6b7280]">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} cart={cart} onSend={onSend} onAction={onAction} />
        ))}
        {loading && (
          <div className="flex items-center gap-3 text-sm text-[#6b7280]">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#10a37f] text-xs font-semibold text-white">AI</span>
            <span className="inline-flex items-center gap-2 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3">
              Rumah Keripik AI sedang menjawab
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9ca3af]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9ca3af] [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9ca3af] [animation-delay:240ms]" />
              </span>
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
