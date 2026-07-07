'use client';

import { Bot } from 'lucide-react';
import type { ChatCartDto, ChatMessageDto } from '@/lib/chat-v3/types';
import { ChatComponentRenderer } from './ChatComponentRenderer';

export function ChatMessage({ message, cart, onSend, onAction }: { message: ChatMessageDto; cart?: ChatCartDto | null; onSend: (message: string) => void; onAction: (action: string, payload?: Record<string, unknown>) => void }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${isSystem ? 'border border-[#e5e7eb] bg-white text-[#6b7280]' : 'bg-[#10a37f] text-white'}`}>
          <Bot size={16} />
        </div>
      )}
      <div className={`max-w-[88%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-3 md:max-w-[78%]`}>
        <div className={`rounded-[1.35rem] px-4 py-3 text-[15px] leading-7 ${isUser ? 'rounded-br-md bg-[#111827] text-white' : isSystem ? 'rounded-bl-md border border-[#e5e7eb] bg-[#f9fafb] text-[#4b5563]' : 'rounded-bl-md border border-[#e5e7eb] bg-white text-[#111827]'}`}>
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        {message.components.length > 0 && (
          <ChatComponentRenderer components={message.components} cart={cart} onSend={onSend} onAction={onAction} />
        )}
      </div>
    </div>
  );
}
