'use client';

import { Bot, UserRound } from 'lucide-react';
import type { ChatCartDto, ChatMessageDto } from '@/lib/chat-v3/types';
import { ChatComponentRenderer } from './ChatComponentRenderer';

export function ChatMessage({ message, cart, onSend, onAction }: { message: ChatMessageDto; cart?: ChatCartDto | null; onSend: (message: string) => void; onAction: (action: string, payload?: Record<string, unknown>) => void }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className={`mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${isSystem ? 'bg-[#fff0c2] text-[#8d4b00]' : 'bg-[#123524] text-white'}`}>
          <Bot size={18} />
        </div>
      )}
      <div className={`max-w-[88%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
        <div className={`rounded-[1.35rem] px-4 py-3 text-sm font-semibold leading-6 shadow-sm ${isUser ? 'rounded-br-sm bg-[#2a1606] text-white' : isSystem ? 'border border-[#e7c88c] bg-[#fff8e8] text-[#5e3d22]' : 'rounded-bl-sm bg-white text-[#2a1606]'}`}>
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        {message.components.length > 0 && (
          <ChatComponentRenderer components={message.components} cart={cart} onSend={onSend} onAction={onAction} />
        )}
      </div>
      {isUser && (
        <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#ffe1aa] text-[#7a3f00]">
          <UserRound size={18} />
        </div>
      )}
    </div>
  );
}
