'use client';

import { useEffect, useRef } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { motion } from 'motion/react';
import { PackageSearch, ShoppingBag, Sparkles } from 'lucide-react';
import type { ChatCartDto, ChatMessageDto } from '@/lib/chat-v3/types';
import { ChatMessage } from './ChatMessage';

const starterPrompts = [
  { icon: <ShoppingBag size={17} />, label: 'Lihat menu best seller' },
  { icon: <Sparkles size={17} />, label: 'Rekomendasi rasa pedas' },
  { icon: <PackageSearch size={17} />, label: 'Cek status pesanan' },
  { icon: <ShoppingBag size={17} />, label: 'Pesan untuk warung' },
];

export function ChatWindow({
  messages,
  cart,
  loading,
  onSend,
  onAction,
}: {
  messages: ChatMessageDto[];
  cart?: ChatCartDto | null;
  loading?: boolean;
  onSend: (message: string) => void;
  onAction: (action: string, payload?: Record<string, unknown>) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const [listRef] = useAutoAnimate<HTMLDivElement>({
    duration: 220,
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, loading]);

  const isEmpty = !loading && messages.length === 0;

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-gutter-stable px-4 pb-32 pt-6 md:px-8 md:pb-40">
      <div className="mx-auto flex max-w-5xl flex-col">
        {isEmpty ? (
          <div className="flex min-h-[calc(100vh-16rem)] items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="w-full max-w-3xl text-center"
            >
              <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-[#eadfce] bg-[#fffaf3]/88 px-4 py-2 text-xs font-medium text-[#6f5d4f] shadow-[0_12px_30px_rgba(47,36,28,0.06)] backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-[#7a963a]" />
                Rumah Keripik AI siap bantu pilih rasa sampai checkout
              </div>
              <h2 className="text-4xl font-semibold tracking-[-0.06em] text-[#2f241c] md:text-6xl">
                Mau pesan keripik
                <br className="hidden md:block" /> dengan cepat?
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#6f5d4f] md:text-lg">
                Tanya stok, bandingkan varian, minta rekomendasi paket, lalu lanjut checkout dalam satu alur chat yang ringan.
              </p>
              <div className="mt-10 grid gap-3 text-left sm:grid-cols-2">
                {starterPrompts.map((item, index) => (
                  <motion.button
                    key={item.label}
                    type="button"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.34, delay: 0.06 * index, ease: 'easeOut' }}
                    onClick={() => onSend(item.label)}
                    className="flex items-center gap-3 rounded-[1.5rem] border border-[#eadfce] bg-[rgba(255,251,245,0.78)] px-4 py-4 text-sm font-medium text-[#2f241c] shadow-[0_16px_36px_rgba(47,36,28,0.05)] backdrop-blur transition hover:-translate-y-0.5 hover:border-[#d8c1a6] hover:bg-[#fffaf3]"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f4ead9] text-[#6b4423]">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>
        ) : (
          <div ref={listRef} className="mx-auto flex w-full max-w-4xl flex-col gap-8">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} cart={cart} onSend={onSend} onAction={onAction} />
            ))}

            {loading && (
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-2xl bg-[linear-gradient(135deg,#7a963a_0%,#5e7b24_100%)] text-white shadow-[0_12px_30px_rgba(94,123,36,0.22)]">
                  <Sparkles size={16} />
                </div>
                <div className="pt-2 text-sm text-[#6b5a4d]">
                  <span className="inline-flex items-center gap-2">
                    Rumah Keripik AI sedang menjawab
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#a08973]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#a08973] [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#a08973] [animation-delay:240ms]" />
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <div ref={endRef} />
      </div>
    </div>
  );
}
