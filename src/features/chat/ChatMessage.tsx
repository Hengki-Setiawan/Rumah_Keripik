'use client';

import { useState } from 'react';
import { Check, Copy, RefreshCcw, ThumbsUp } from 'lucide-react';
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
  const [liked, setLiked] = useState(false);

  async function copyMessage() {
    if (!message.content?.trim()) return;
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <motion.div
          initial={isFirstAssistant && !reducedMotion ? { opacity: 0, scale: 0.92, y: 10 } : false}
          animate={
            isFirstAssistant && !reducedMotion
              ? { opacity: 1, scale: [1, 1.06, 1], y: 0 }
              : {}
          }
          transition={{ duration: 0.42, ease: 'easeOut' }}
          className={`mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${
            isSystem
              ? 'border border-[#e7dccb] bg-[#fffaf3] text-[#7a6959]'
              : 'bg-[linear-gradient(135deg,#7f9f3e_0%,#67812d_100%)] text-white shadow-[0_12px_30px_rgba(103,129,45,0.22)]'
          }`}
        >
          <span className="text-[12px] font-semibold">{isSystem ? 'S' : 'AI'}</span>
        </motion.div>
      )}

      <div className={`flex max-w-[90%] flex-col gap-3 md:max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
        {hasText && (
          <div
            className={`${
              isUser
                ? 'rounded-[1.6rem] rounded-br-md bg-[#c55a2b] px-4 py-3 text-white shadow-[0_20px_46px_rgba(197,90,43,0.16)]'
                : isSystem
                  ? 'rounded-[1.35rem] border border-[#e7dccb] bg-[#f7efe1] px-4 py-3 text-[#665444]'
                  : 'px-0 py-1 text-[#2f241c]'
            }`}
          >
            <p className={`whitespace-pre-wrap text-[15px] leading-7 ${!isUser && !isSystem ? 'md:text-[16px]' : ''}`}>
              {message.content}
            </p>
          </div>
        )}

        {!isUser && !isSystem && hasText && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#8a7562]">
            <button
              type="button"
              onClick={copyMessage}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition hover:bg-[#f8efe2] hover:text-[#2f241c]"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Tersalin' : 'Salin'}
            </button>
            <button
              type="button"
              onClick={() => onSend('Jelaskan lagi dengan lebih ringkas')}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition hover:bg-[#f8efe2] hover:text-[#2f241c]"
            >
              <RefreshCcw size={13} />
              Ulang
            </button>
            <button
              type="button"
              onClick={() => setLiked((value) => !value)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition hover:bg-[#f8efe2] hover:text-[#2f241c] ${
                liked ? 'bg-[#eef6dd] text-[#5d7b20]' : ''
              }`}
            >
              <ThumbsUp size={13} />
              {liked ? 'Membantu' : 'Bagus'}
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
