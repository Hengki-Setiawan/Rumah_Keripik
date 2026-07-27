'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { motion, useReducedMotion } from 'motion/react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { PackageSearch, ShoppingBag, Sparkles, Plus } from 'lucide-react';
import type { ChatCartDto, ChatMessageDto } from '@/lib/chat-v3/types';

import { ChatMessage } from './ChatMessage';
import { QuickReplies } from './components/QuickReplies';

type ProductDto = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  priceLabel: string;
  imageUrl: string | null;
  categoryName: string | null;
};

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
  const [products, setProducts] = useState<ProductDto[]>([]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, loading]);

  useEffect(() => {
    if (!idle) return;
    let cancelled = false;
    fetch('/api/public/products')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          const featured = (data.products || []).filter((p: ProductDto) => p.imageUrl).slice(0, 4);
          setProducts(featured);
        }
      })
      .catch(() => { if (!cancelled) setProducts([]); });
    return () => { cancelled = true; };
  }, [idle]);

  const stickyReplies = useMemo(() => {
    if (loading || idle) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== 'assistant' && msg.role !== 'system') continue;
      const qr = msg.components?.find((c) => c.type === 'quick_replies');
      if (qr) return qr;
    }
    return null;
  }, [messages, loading, idle]);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-gutter-stable px-3 pb-6 pt-2 md:px-6 md:pb-8 md:pt-3">
      <div className="mx-auto flex max-w-4xl flex-col">
        {idle ? (
          <div className="flex min-h-[calc(100dvh-10.5rem)] flex-col items-center justify-center md:min-h-[calc(100dvh-8.5rem)]">
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 18 }}
              animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
              transition={{ duration: 0.42, ease: 'easeOut' }}
              data-testid="chat-idle-container"
              className="w-full max-w-3xl text-center"
            >
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#fffaf3] shadow-[0_12px_32px_rgba(197,90,43,0.12)]">
                <BrandLogo variant="mark" className="h-10 w-10 object-contain" />
              </div>
              <h2 className="text-[2rem] font-semibold leading-[0.98] tracking-[-0.06em] text-[#2f241c] sm:text-[2.4rem] md:text-5xl">
                Mau pesan keripik apa hari ini?
              </h2>
              <p className="mx-auto mt-3 max-w-lg px-2 text-sm leading-6 text-[#6f5d4f] md:px-0 md:text-base">
                Pilih langsung produk di bawah, atau tulis pesananmu.
              </p>

              {products.length > 0 && (
                <motion.div
                  initial={reducedMotion ? false : { opacity: 0, y: 14 }}
                  animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.34, delay: 0.1, ease: 'easeOut' }}
                  className="mx-auto mt-8 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4"
                >
                  {products.map((product, index) => (
                    <motion.button
                      key={product.id}
                      data-testid={`idle-product-${product.id}`}
                      initial={reducedMotion ? false : { opacity: 0, y: 14 }}
                      animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: 0.06 * index, ease: 'easeOut' }}
                      onClick={() => onAction('add_to_cart', { productId: product.id, quantity: 1 })}
                      className="group flex flex-col items-center gap-2 rounded-[1.4rem] border border-[#f0dfca] bg-[rgba(255,250,244,0.88)] p-3 text-center shadow-[0_8px_18px_rgba(47,36,28,0.04)] backdrop-blur transition hover:-translate-y-1 hover:border-[#dfc5a8] hover:bg-white"
                    >
                      <div className="h-20 w-full overflow-hidden rounded-[0.9rem] bg-[#f7eddf]">
                        <img
                          src={product.imageUrl || ''}
                          alt={product.name}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      </div>
                      <span className="text-xs font-semibold text-[#2f241c] leading-tight line-clamp-2">{product.name}</span>
                      <span className="text-[11px] font-medium text-[#c55a2b]">{product.priceLabel}</span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c55a2b] text-white transition group-hover:bg-[#ae4d23]">
                        <Plus size={13} />
                      </span>
                    </motion.button>
                  ))}
                </motion.div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {starterPrompts.map((item, index) => (
                  <motion.button
                    key={item.label}
                    type="button"
                    data-testid={`chat-starter-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    initial={reducedMotion ? false : { opacity: 0, y: 14 }}
                    animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: 0.08 * index + 0.2, ease: 'easeOut' }}
                    onClick={() => onSend(item.label)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#f0dfca] bg-[rgba(255,250,244,0.88)] px-3.5 py-2 text-sm font-medium text-[#5f4d3f] shadow-[0_8px_18px_rgba(47,36,28,0.04)] backdrop-blur transition hover:-translate-y-0.5 hover:border-[#dfc5a8] hover:bg-white"
                  >
                    <span className="text-[#c55a2b]">{item.icon}</span>
                    {item.label}
                  </motion.button>
                ))}
              </div>

              {footerSlot}
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
                  hideQuickReplies
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

            {stickyReplies && (
              <QuickReplies component={stickyReplies} onSend={onSend} onAction={onAction} />
            )}
          </div>
        )}

        <div ref={endRef} />
      </div>
    </div>
  );
}
