'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Menu, PackageSearch, ShieldCheck, ShoppingBag, Sparkles, X } from 'lucide-react';
import type { ChatCartDto, ChatMessageDto } from '@/lib/chat-v3/types';
import { ChatComposer } from './ChatComposer';
import { ChatSidebar, type ChatSessionSummary } from './ChatSidebar';
import { ChatWindow } from './ChatWindow';

export function ChatShell() {
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [cart, setCart] = useState<ChatCartDto | null>(null);
  const [chatSessionId, setChatSessionId] = useState<string>('');
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    loadSessions().catch(() => undefined);
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

  async function bootstrap(forceNew = false) {
    setLoading(true);
    const response = await fetch('/api/customer/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forceNew }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Session gagal');
    setChatSessionId(data.chatSession.id);
    setMessages(data.messages || []);
    setCart(data.cart || null);
    setStarted(true);
    setLoading(false);
    loadSessions().catch(() => undefined);
  }

  async function startNewOrder() {
    setError('');
    try {
      await bootstrap(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat belum bisa dimuat. Coba refresh halaman.');
      setLoading(false);
    }
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
    <main className="h-screen overflow-hidden bg-[#fafafa] text-[#111827]">
      {!started && (
        <OpeningScreen loading={loading} error={error} onStart={startNewOrder} />
      )}
      {started && (
      <div className="flex h-full">
        <div className="hidden w-[280px] shrink-0 lg:block"><ChatSidebar sessions={sessions} activeId={chatSessionId} cartCount={cart?.itemCount || 0} onNewOrder={startNewOrder} /></div>
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw]"><ChatSidebar sessions={sessions} activeId={chatSessionId} cartCount={cart?.itemCount || 0} onNewOrder={startNewOrder} /></div>
            <button className="absolute right-4 top-4 rounded-full border border-[#e5e7eb] bg-white p-2 text-[#111827] shadow-[0_8px_24px_rgba(0,0,0,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]/20" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
          </div>
        )}

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-[#e5e7eb] bg-white/90 px-4 backdrop-blur md:px-6">
            <div className="flex items-center gap-3">
               <button className="rounded-xl p-2 text-[#6b7280] transition hover:bg-[#f3f4f6] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]/20 lg:hidden" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={17} className="text-[#10a37f]" />
                  <h1 className="font-semibold tracking-[-0.02em] text-[#111827]">Rumah Keripik AI</h1>
                </div>
                <p className="text-xs text-[#6b7280]">Asisten pemesanan keripik</p>
              </div>
            </div>
            <a href="/pesan/lacak" className="inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-[#111827] transition hover:bg-[#f3f4f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]/20"><PackageSearch size={16} /> Lacak</a>
          </header>

          {error && <div className="mx-4 mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 md:mx-8">{error}</div>}
          <ChatWindow messages={messages} cart={cart} loading={loading || sending} onSend={sendMessage} onAction={runAction} />
          <div className="border-t border-transparent bg-[#fafafa] px-3 pb-4 pt-2 md:px-5 md:pb-6">
            <div className="mx-auto max-w-4xl"><ChatComposer disabled={loading || sending || !chatSessionId} onSend={sendMessage} /></div>
          </div>
        </section>
      </div>
      )}
    </main>
  );
}

function OpeningScreen({ loading, error, onStart }: { loading: boolean; error: string; onStart: () => void }) {
  return (
    <div className="relative flex h-full min-h-screen items-center justify-center overflow-hidden px-5 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(16,163,127,0.10),transparent_32%),radial-gradient(circle_at_85%_70%,rgba(217,119,6,0.08),transparent_28%)]" />
      <div className="pointer-events-none absolute left-1/2 top-16 h-56 w-56 -translate-x-1/2 rounded-full border border-[#e5e7eb] bg-white/50 blur-3xl" />

      <section className="relative z-10 mx-auto w-full max-w-5xl">
        <div className="mx-auto mb-8 flex w-fit items-center gap-2 rounded-full border border-[#e5e7eb] bg-white/80 px-3 py-1.5 text-xs font-medium text-[#6b7280] shadow-[0_1px_2px_rgba(0,0,0,0.03)] backdrop-blur animate-[rkFadeUp_0.6s_ease-out_both]">
          <span className="h-2 w-2 rounded-full bg-[#10a37f]" />
          AI ordering siap bantu dari pilih rasa sampai checkout
        </div>

        <div className="grid items-center gap-10 lg:grid-cols-[1fr_420px]">
          <div className="text-center lg:text-left">
            <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-[#111827] text-white shadow-[0_18px_50px_rgba(15,23,42,0.16)] lg:mx-0 animate-[rkFloat_4s_ease-in-out_infinite]">
              <Sparkles size={25} />
            </div>
            <h1 className="text-4xl font-semibold tracking-[-0.06em] text-[#111827] md:text-6xl animate-[rkFadeUp_0.7s_ease-out_0.05s_both]">
              Pesan keripik lewat chat yang terasa personal.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#6b7280] md:text-lg lg:mx-0 animate-[rkFadeUp_0.7s_ease-out_0.12s_both]">
              Mulai dari tanya stok, rekomendasi rasa, bangun keranjang, pilih pembayaran, sampai cek status pesanan. Semua dari satu percakapan yang rapi.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start animate-[rkFadeUp_0.7s_ease-out_0.2s_both]">
              <button
                type="button"
                onClick={onStart}
                disabled={loading}
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-[#111827] px-6 py-4 text-sm font-medium text-white shadow-[0_16px_44px_rgba(15,23,42,0.18)] transition hover:bg-[#374151] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]/20 disabled:cursor-not-allowed disabled:bg-[#d1d5db]"
              >
                {loading ? 'Menyiapkan chat...' : 'Mulai Pesan Baru'}
                <ArrowRight size={17} className="transition group-hover:translate-x-0.5" />
              </button>
              <a href="/pesan/lacak" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#e5e7eb] bg-white/80 px-6 py-4 text-sm font-medium text-[#111827] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]/20">
                <PackageSearch size={17} /> Lacak Pesanan
              </a>
            </div>
            {error && <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
          </div>

          <div className="relative mx-auto w-full max-w-md animate-[rkFadeUp_0.8s_ease-out_0.18s_both]">
            <div className="rounded-[2rem] border border-[#e5e7eb] bg-white/90 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur">
              <div className="mb-4 flex items-center justify-between border-b border-[#eef0f2] pb-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#10a37f] text-xs font-semibold text-white">AI</div>
                  <div>
                    <p className="text-sm font-semibold tracking-[-0.02em]">Rumah Keripik AI</p>
                    <p className="text-xs text-[#6b7280]">Online sekarang</p>
                  </div>
                </div>
                <span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[11px] font-medium text-[#6b7280]">Premium flow</span>
              </div>

              <div className="space-y-3">
                <div className="max-w-[86%] rounded-2xl rounded-bl-md border border-[#e5e7eb] bg-white px-4 py-3 text-sm leading-6 text-[#111827] animate-[rkMessageIn_0.55s_ease-out_0.35s_both]">
                  Halo kak, mau pesan untuk ngemil sendiri, keluarga, atau stok warung?
                </div>
                <div className="ml-auto max-w-[76%] rounded-2xl rounded-br-md bg-[#111827] px-4 py-3 text-sm leading-6 text-white animate-[rkMessageIn_0.55s_ease-out_0.7s_both]">
                  Rekomendasi rasa pedas best seller dong.
                </div>
                <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-[#e5e7eb] bg-white px-4 py-3 text-sm leading-6 text-[#111827] animate-[rkMessageIn_0.55s_ease-out_1.05s_both]">
                  Siap. Aku cek stok dan susun paket yang paling cocok.
                  <div className="mt-3 grid gap-2">
                    <div className="flex items-center gap-2 rounded-xl bg-[#f7f7f8] px-3 py-2 text-xs font-medium text-[#4b5563]"><ShoppingBag size={14} /> Paket Pedas Favorit</div>
                    <div className="flex items-center gap-2 rounded-xl bg-[#f7f7f8] px-3 py-2 text-xs font-medium text-[#4b5563]"><ShieldCheck size={14} /> Checkout aman dan bisa dilacak</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        @keyframes rkFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes rkFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes rkMessageIn {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
