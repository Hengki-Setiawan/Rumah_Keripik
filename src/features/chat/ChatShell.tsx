'use client';

import { useEffect, useState } from 'react';
import { Menu, Sparkles, X } from 'lucide-react';
import type { ChatCartDto, ChatMessageDto } from '@/lib/chat-v3/types';
import { ChatComposer } from './ChatComposer';
import { ChatSidebar, type ChatSessionSummary } from './ChatSidebar';
import { ChatWindow } from './ChatWindow';

export function ChatShell() {
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [cart, setCart] = useState<ChatCartDto | null>(null);
  const [chatSessionId, setChatSessionId] = useState<string>('');
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    bootstrap().catch(() => setError('Chat belum bisa dimuat. Coba refresh halaman.'));
  }, []);

  useEffect(() => {
    if (!chatSessionId || sending) return;
    const timer = window.setInterval(() => {
      refreshChatState().catch(() => undefined);
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [chatSessionId, sending]);

  useEffect(() => {
    if (!chatSessionId || typeof EventSource === 'undefined') return;
    const source = new EventSource(`/api/chat/stream?chatSessionId=${encodeURIComponent(chatSessionId)}`);
    source.addEventListener('chat_state', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        if (data.ok) {
          setMessages(data.messages || []);
          setCart(data.cart || null);
        }
      } catch {
        // Ignore malformed SSE payloads and keep polling fallback alive.
      }
    });
    source.onerror = () => source.close();
    return () => source.close();
  }, [chatSessionId]);

  async function bootstrap() {
    setLoading(true);
    const response = await fetch('/api/customer/session', { method: 'POST' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Session gagal');
    setChatSessionId(data.chatSession.id);
    setMessages(data.messages || []);
    setCart(data.cart || null);
    setLoading(false);
    loadSessions().catch(() => undefined);
  }

  async function loadSessions() {
    const response = await fetch('/api/chat/sessions');
    const data = await response.json();
    if (data.ok) setSessions(data.sessions || []);
  }

  async function refreshChatState() {
    if (!chatSessionId) return;
    const response = await fetch(`/api/chat/state?chatSessionId=${encodeURIComponent(chatSessionId)}`);
    const data = await response.json();
    if (!response.ok || !data.ok) return;
    setMessages(data.messages || []);
    setCart(data.cart || null);
    loadSessions().catch(() => undefined);
  }

  async function sendMessage(text: string) {
    if (!chatSessionId) return;
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatSessionId, message: text }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Pesan gagal dikirim');
      setMessages(data.messages || []);
      setCart(data.cart || null);
      loadSessions().catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pesan gagal dikirim');
    } finally {
      setSending(false);
    }
  }

  async function runAction(action: string, payload: Record<string, unknown> = {}) {
    if (action.startsWith('/')) {
      window.location.href = action;
      return;
    }
    if (!chatSessionId) return;
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/chat/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatSessionId, action, payload }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Aksi gagal');
      setMessages(data.messages || []);
      setCart(data.cart || null);
      loadSessions().catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aksi gagal');
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="h-screen overflow-hidden bg-[#fff7df] text-[#241306]">
      <div className="absolute inset-0 -z-0 bg-[radial-gradient(circle_at_15%_15%,rgba(245,158,11,0.24),transparent_28%),radial-gradient(circle_at_85%_5%,rgba(34,197,94,0.16),transparent_24%),linear-gradient(135deg,#fff8df_0%,#fff1c4_45%,#f6df9d_100%)]" />
      <div className="relative z-10 flex h-full">
        <div className="hidden w-80 shrink-0 lg:block"><ChatSidebar sessions={sessions} activeId={chatSessionId} cartCount={cart?.itemCount || 0} /></div>
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw]"><ChatSidebar sessions={sessions} activeId={chatSessionId} cartCount={cart?.itemCount || 0} /></div>
            <button className="absolute right-4 top-4 rounded-full bg-white p-2" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
          </div>
        )}

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-[#e7c88c] bg-white/70 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex items-center gap-3">
              <button className="rounded-2xl bg-[#fff0c2] p-2 text-[#8d4b00] lg:hidden" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-[#8d4b00]" />
                  <h1 className="font-black tracking-[-0.02em] text-[#2a1606]">Rumah Keripik AI</h1>
                </div>
                <p className="text-xs font-bold text-[#735033]">Ngobrol, pilih card, checkout, dan lacak pesanan.</p>
              </div>
            </div>
            <a href="/pesan/lacak" className="rounded-full border border-[#e0bd82] bg-white px-4 py-2 text-sm font-black text-[#7a3f00]">Lacak</a>
          </header>

          {error && <div className="mx-4 mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 md:mx-8">{error}</div>}
          <ChatWindow messages={messages} cart={cart} loading={loading || sending} onSend={sendMessage} onAction={runAction} />
          <div className="border-t border-[#e7c88c] bg-[#fff7df]/85 p-3 backdrop-blur md:p-5">
            <div className="mx-auto max-w-4xl"><ChatComposer disabled={loading || sending || !chatSessionId} onSend={sendMessage} /></div>
          </div>
        </section>
      </div>
    </main>
  );
}
