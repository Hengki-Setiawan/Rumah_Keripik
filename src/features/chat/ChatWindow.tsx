'use client';

import { useEffect, useRef } from 'react';
import type { ChatCartDto, ChatMessageDto } from '@/lib/chat-v3/types';
import { ChatMessage } from './ChatMessage';

export function ChatWindow({ messages, cart, loading, onSend, onAction }: { messages: ChatMessageDto[]; cart?: ChatCartDto | null; loading?: boolean; onSend: (message: string) => void; onAction: (action: string, payload?: Record<string, unknown>) => void }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, loading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} cart={cart} onSend={onSend} onAction={onAction} />
        ))}
        {loading && (
          <div className="flex items-center gap-3 text-sm font-bold text-[#735033]">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#123524] text-white">AI</span>
            <span className="rounded-2xl bg-white px-4 py-3 shadow-sm">Sedang memilih jawaban terbaik...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
