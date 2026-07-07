'use client';

import { Bot } from 'lucide-react';
import type { ChatCartDto, ChatMessageDto } from '@/lib/chat-v3/types';
import { ChatComponentRenderer } from './ChatComponentRenderer';

export function ChatMessage({
  message,
  cart,
  onSend,
  onAction,
}: {
  message: ChatMessageDto;
  cart?: ChatCartDto | null;
  onSend: (message: string) => void;
  onAction: (action: string, payload?: Record<string, unknown>) => void;
}) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const hasText = Boolean(message.content?.trim());

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div
          className={`mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${
            isSystem
              ? 'border border-[#e7dccb] bg-[#fffaf3] text-[#7a6959]'
              : 'bg-[linear-gradient(135deg,#7a963a_0%,#5e7b24_100%)] text-white shadow-[0_12px_30px_rgba(94,123,36,0.22)]'
          }`}
        >
          <Bot size={16} />
        </div>
      )}

      <div className={`flex max-w-[90%] flex-col gap-3 md:max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
        {hasText && (
          <div
            className={`${
              isUser
                ? 'rounded-[1.6rem] rounded-br-md bg-[#6b4423] px-4 py-3 text-white shadow-[0_20px_46px_rgba(107,68,35,0.16)]'
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

        {message.components.length > 0 && (
          <div className={`${!isUser ? 'w-full' : 'max-w-full'}`}>
            <ChatComponentRenderer components={message.components} cart={cart} onSend={onSend} onAction={onAction} />
          </div>
        )}
      </div>
    </div>
  );
}
