'use client';

import { useState } from 'react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Check, Copy, Loader2, RefreshCcw, ThumbsDown, ThumbsUp } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { ChatCartDto, ChatMessageDto } from '@/lib/chat-v3/types';
import { ChatComponentRenderer } from './ChatComponentRenderer';

export function ChatMessage({
  message,
  cart,
  onSend,
  onAction,
  isFirstAssistant = false,
}: {
  message: ChatMessageDto;
  cart?: ChatCartDto | null;
  onSend: (message: string) => void;
  onAction: (action: string, payload?: Record<string, unknown>) => void;
  isFirstAssistant?: boolean;
}) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const hasText = Boolean(message.content?.trim());
  const reducedMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'helpful' | 'not_helpful' | null>(null);
  const [loggingFeedback, setLoggingFeedback] = useState(false);

  async function copyMessage() {
    if (!message.content?.trim()) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  async function submitFeedback(nextFeedback: 'helpful' | 'not_helpful', rating: number) {
    if (feedback || loggingFeedback) return;
    setLoggingFeedback(true);
    try {
      await Promise.resolve(
        onAction('message_feedback', {
          messageId: message.id,
          rating,
          label: nextFeedback,
        })
      );
      setFeedback(nextFeedback);
    } finally {
      setLoggingFeedback(false);
    }
  }

  return (
    <div className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <motion.div
          initial={isFirstAssistant && !reducedMotion ? { opacity: 0, scale: 0.92, y: 10 } : false}
          animate={
            isFirstAssistant && !reducedMotion
              ? { opacity: 1, scale: [1, 1.06, 1], y: 0 }
              : {}
          }
          transition={{ duration: 0.42, ease: 'easeOut' }}
          className={`mt-1 grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-xl ${
            isSystem
              ? 'border border-[#e7dccb] bg-[#fffaf3] text-[#7a6959]'
              : 'bg-[#fffaf3] shadow-[0_12px_30px_rgba(107,68,35,0.12)]'
          }`}
        >
          {isSystem ? (
            <span className="text-[12px] font-semibold">S</span>
          ) : (
            <BrandLogo variant="mark" className="h-full w-full object-contain" />
          )}
        </motion.div>
      )}

      <div className={`flex max-w-[88%] flex-col gap-2 md:max-w-[76%] ${isUser ? 'items-end' : 'items-start'}`}>
        {hasText && (
          <div
            className={`${
              isUser
                ? 'rounded-[1.35rem] rounded-br-md bg-[#c55a2b] px-4 py-2.5 text-white shadow-[0_16px_34px_rgba(197,90,43,0.14)]'
                : isSystem
                  ? 'rounded-[1.2rem] border border-[#e7dccb] bg-[#f7efe1] px-3.5 py-2.5 text-[#665444]'
                  : 'px-0 py-0.5 text-[#2f241c]'
            }`}
          >
            <p className={`whitespace-pre-wrap text-[14px] leading-6 ${!isUser && !isSystem ? 'md:text-[15px]' : ''}`}>
              {message.content}
            </p>
          </div>
        )}

        {!isUser && !isSystem && hasText && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#8a7562]">
            <button
              type="button"
              onClick={copyMessage}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition hover:bg-[#f8efe2] hover:text-[#2f241c]"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Tersalin' : 'Salin'}
            </button>
            <button
              type="button"
              onClick={() => onSend('Jelaskan lagi dengan lebih ringkas')}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition hover:bg-[#f8efe2] hover:text-[#2f241c]"
            >
              <RefreshCcw size={12} />
              Ulang
            </button>
            <button
              type="button"
              onClick={() => submitFeedback('helpful', 5)}
              disabled={Boolean(feedback) || loggingFeedback}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 transition hover:bg-[#f8efe2] hover:text-[#2f241c] ${
                feedback === 'helpful' ? 'bg-[#eef6dd] text-[#5d7b20]' : ''
              }`}
            >
              {loggingFeedback ? <Loader2 size={12} className="animate-spin" /> : <ThumbsUp size={12} />}
              {feedback === 'helpful' ? 'Membantu' : loggingFeedback ? 'Menyimpan' : 'Bagus'}
            </button>
            <button
              type="button"
              onClick={() => submitFeedback('not_helpful', 2)}
              disabled={Boolean(feedback) || loggingFeedback}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 transition hover:bg-[#f8efe2] hover:text-[#2f241c] ${
                feedback === 'not_helpful' ? 'bg-[#fff1db] text-[#b45309]' : ''
              }`}
            >
              <ThumbsDown size={12} />
              {feedback === 'not_helpful' ? 'Kurang pas' : 'Kurang pas'}
            </button>
          </div>
        )}

        {message.components.length > 0 && (
          <div className={`${!isUser ? 'w-full' : 'max-w-full'}`}>
            <ChatComponentRenderer components={message.components} cart={cart} onSend={onSend} onAction={onAction} />
          </div>
        )}
      </div>
    </div>
  );
}
