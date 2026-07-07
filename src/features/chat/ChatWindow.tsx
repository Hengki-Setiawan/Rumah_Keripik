'use client';

import { useEffect, useRef } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { motion } from 'motion/react';
import { PackageSearch, ShoppingBag, Sparkles } from 'lucide-react';
import type { ChatCartDto, ChatMessageDto } from '@/lib/chat-v3/types';
import { ChatMessage } from './ChatMessage';

const starterPrompts = [
  { icon: <ShoppingBag size={16} />, label: 'Lihat produk' },
  { icon: <Sparkles size={16} />, label: 'Rekomendasi pedas' },
  { icon: <PackageSearch size={16} />, label: 'Cek pesanan' },
];

export function ChatWindow({
  messages,
  cart,
  loading,
  idle = false,
  footerSlot,
  onSend,
  onAction,
}: {
  messages: ChatMessageDto[];
  cart?: ChatCartDto | null;
  loading?: boolean;
  idle?: boolean;
  footerSlot?: React.ReactNode;
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

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-gutter-stable px-4 pb-10 pt-4 md:px-8 md:pt-6">
      <div className="mx-auto flex max-w-5xl flex-col">
        {idle ? (
          <div className="flex min-h-[calc(100vh-11rem)] items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, ease: 'easeOut' }}
              className="w-full max-w-4xl text-center"
            >
              <motion.div
                animate={{ y: [0, -5, 0], rotate: [0, -1, 0] }}
                transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
                className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-[1.6rem] bg-[#c55a2b] text-white shadow-[0_18px_46px_rgba(197,90,43,0.20)]"
              >
                <Sparkles size={24} />
              </motion.div>

              <h2 className="text-4xl font-semibold tracking-[-0.065em] text-[#2f241c] md:text-6xl">
                Mau pesan keripik apa hari ini?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[#6f5d4f] md:text-lg">
                Pilih rasa, atur jumlah, dan checkout lewat percakapan yang sederhana.
              </p>

              {footerSlot}

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                {starterPrompts.map((item, index) => (
                  <motion.button
                    key={item.label}
                    type="button"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: 0.08 * index, ease: 'easeOut' }}
                    onClick={() => onSend(item.label)}
                    className="inline-flex items-center gap-2 rounded-full border border-[#f0dfca] bg-[rgba(255,250,244,0.88)] px-4 py-2.5 text-sm font-medium text-[#5f4d3f] shadow-[0_10px_24px_rgba(47,36,28,0.04)] backdrop-blur transition hover:-translate-y-0.5 hover:border-[#dfc5a8] hover:bg-white"
                  >
                    <span className="text-[#c55a2b]">{item.icon}</span>
                    {item.label}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>
        ) : (
          <div ref={listRef} className="mx-auto flex w-full max-w-4xl flex-col gap-8 pb-8 pt-8">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} cart={cart} onSend={onSend} onAction={onAction} />
            ))}

            {loading && (
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-2xl bg-[linear-gradient(135deg,#7f9f3e_0%,#67812d_100%)] text-white shadow-[0_12px_30px_rgba(103,129,45,0.22)]">
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
