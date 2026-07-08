'use client';

import { useEffect, useRef } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { motion, useReducedMotion } from 'motion/react';
import { BrandLogo } from '@/components/brand/BrandLogo';
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
  const reducedMotion = useReducedMotion();
  const [listRef] = useAutoAnimate<HTMLDivElement>({
    duration: 220,
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, loading]);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-gutter-stable px-3 pb-6 pt-2 md:px-6 md:pb-8 md:pt-3">
      <div className="mx-auto flex max-w-4xl flex-col">
        {idle ? (
          <div className="flex min-h-[calc(100dvh-10.5rem)] items-center justify-center md:min-h-[calc(100dvh-8.5rem)]">
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 18 }}
              animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
              transition={{ duration: 0.42, ease: 'easeOut' }}
              className="w-full max-w-3xl text-center"
            >
              <h2 className="text-[2rem] font-semibold leading-[0.98] tracking-[-0.06em] text-[#2f241c] sm:text-[2.4rem] md:text-5xl">
                Mau pesan keripik apa hari ini?
              </h2>
              <p className="mx-auto mt-3 max-w-lg px-2 text-sm leading-6 text-[#6f5d4f] md:px-0 md:text-base">
                Pilih rasa, atur jumlah, dan checkout lewat percakapan yang sederhana.
              </p>

              {footerSlot}

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {starterPrompts.map((item, index) => (
                  <motion.button
                    key={item.label}
                    type="button"
                    data-testid={`starter-prompt-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    initial={reducedMotion ? false : { opacity: 0, y: 14 }}
                    animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: 0.08 * index, ease: 'easeOut' }}
                    onClick={() => onSend(item.label)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#f0dfca] bg-[rgba(255,250,244,0.88)] px-3.5 py-2 text-sm font-medium text-[#5f4d3f] shadow-[0_8px_18px_rgba(47,36,28,0.04)] backdrop-blur transition hover:-translate-y-0.5 hover:border-[#dfc5a8] hover:bg-white"
                  >
                    <span className="text-[#c55a2b]">{item.icon}</span>
                    {item.label}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>
        ) : (
          <div ref={listRef} className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-6 pt-4">
            {messages.map((message, index) => {
              const isFirstAssistant = message.role === 'assistant' && messages.slice(0, index).every((item) => item.role !== 'assistant');
              return (
                <ChatMessage
                  key={message.id}
                  message={message}
                  cart={cart}
                  onSend={onSend}
                  onAction={onAction}
                  isFirstAssistant={isFirstAssistant}
                />
              );
            })}

            {loading && (
              <div className="flex items-start gap-3">
                <div className="overflow-hidden rounded-xl bg-[#fffaf3] shadow-[0_10px_22px_rgba(107,68,35,0.1)]">
                  <BrandLogo variant="mark" className="h-8 w-8 object-contain" />
                </div>
                <div className="pt-1.5 text-sm text-[#6b5a4d]">
                  <span className="inline-flex items-center gap-2">
                    Rumah Keripik sedang menjawab
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
