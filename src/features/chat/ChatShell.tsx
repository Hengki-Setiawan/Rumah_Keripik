'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Menu,
  PackageSearch,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react';
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const [sessionLoadingId, setSessionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resumeLatestSession() {
      const loadedSessions = await loadSessions();
      if (cancelled || loadedSessions.length === 0) return;
      await openSession(loadedSessions[0].id, loadedSessions, true);
    }

    resumeLatestSession().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

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
    setSidebarOpen(false);
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
    const loadedSessions = data.ok ? (data.sessions || []) : [];
    if (data.ok) setSessions(loadedSessions);
    return loadedSessions as ChatSessionSummary[];
  }

  async function openSession(nextSessionId: string, nextSessions?: ChatSessionSummary[], silent = false) {
    if (!nextSessionId) return;
    if (!silent) {
      setSessionLoadingId(nextSessionId);
      setError('');
    }

    try {
      const response = await fetch(`/api/chat/state?chatSessionId=${encodeURIComponent(nextSessionId)}`);
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Riwayat chat gagal dibuka');
      if (nextSessions) {
        setSessions(nextSessions);
      } else {
        loadSessions().catch(() => undefined);
      }
      setChatSessionId(nextSessionId);
      setMessages(data.messages || []);
      setCart(data.cart || null);
      setStarted(true);
      setSidebarOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Riwayat chat gagal dibuka');
    } finally {
      if (!silent) setSessionLoadingId(null);
    }
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

  useEffect(() => {
    if (!chatSessionId || sending) return;
    const timer = window.setInterval(() => {
      refreshChatState().catch(() => undefined);
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [chatSessionId, sending]);

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
    <main className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(214,162,74,0.16),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(111,138,58,0.10),transparent_20%),linear-gradient(180deg,#f8f4ec_0%,#fbf8f2_100%)] text-[#2f241c]">
      {!started && <OpeningScreen loading={loading} error={error} onStart={startNewOrder} />}

      {started && (
        <div className="flex h-full">
          <motion.div
            animate={{ width: sidebarCollapsed ? 92 : 320 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="hidden shrink-0 lg:block"
          >
            <ChatSidebar
              sessions={sessions}
              activeId={chatSessionId}
              cartCount={cart?.itemCount || 0}
              compact={sidebarCollapsed}
              onToggleCompact={() => setSidebarCollapsed((value) => !value)}
              onNewOrder={startNewOrder}
              onSelectSession={openSession}
              loadingSessionId={sessionLoadingId}
            />
          </motion.div>

          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 lg:hidden"
              >
                <div className="absolute inset-0 bg-black/22 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
                <motion.div
                  initial={{ x: -32, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -28, opacity: 0 }}
                  transition={{ duration: 0.26, ease: 'easeOut' }}
                  className="absolute inset-y-0 left-0 w-[308px] max-w-[88vw]"
                >
                  <ChatSidebar
                    sessions={sessions}
                    activeId={chatSessionId}
                    cartCount={cart?.itemCount || 0}
                    mobile
                    onNewOrder={startNewOrder}
                    onSelectSession={openSession}
                    loadingSessionId={sessionLoadingId}
                  />
                </motion.div>
                <button
                  type="button"
                  className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full border border-[#eadfce] bg-[#fffaf3] text-[#2f241c] shadow-[0_12px_34px_rgba(47,36,28,0.12)]"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X size={18} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <section className="relative flex min-w-0 flex-1 flex-col">
            <header className="flex items-center justify-between px-4 pb-2 pt-4 md:px-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="grid h-11 w-11 place-items-center rounded-full border border-[#eadfce] bg-[#fffaf3]/85 text-[#6f5d4f] shadow-[0_10px_26px_rgba(47,36,28,0.06)] backdrop-blur transition hover:text-[#2f241c] lg:hidden"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu size={18} />
                </button>
                <div className="hidden md:block">
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#9a8672]">AI Workspace</p>
                  <h1 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[#2f241c]">Rumah Keripik AI</h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/pesan/lacak"
                  className="inline-flex items-center gap-2 rounded-full border border-[#eadfce] bg-[#fffaf3]/90 px-4 py-2 text-sm font-medium text-[#2f241c] shadow-[0_10px_24px_rgba(47,36,28,0.04)] backdrop-blur transition hover:bg-[#ffffff]"
                >
                  <PackageSearch size={16} />
                  <span className="hidden sm:inline">Lacak</span>
                </a>
                <button
                  type="button"
                  onClick={startNewOrder}
                  className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-4 py-2 text-sm font-medium text-white shadow-[0_14px_30px_rgba(17,17,17,0.16)] transition hover:bg-[#222222]"
                >
                  <Sparkles size={15} />
                  <span className="hidden sm:inline">Chat baru</span>
                </button>
              </div>
            </header>

            {error && (
              <div className="mx-4 mt-2 rounded-[1.4rem] border border-red-200 bg-red-50/90 px-4 py-3 text-sm font-medium text-red-700 md:mx-6">
                {error}
              </div>
            )}

            <ChatWindow messages={messages} cart={cart} loading={loading || sending} onSend={sendMessage} onAction={runAction} />

            <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-4 md:px-6 md:pb-6">
              <div className="mx-auto max-w-4xl">
                <div className="pointer-events-auto">
                  <ChatComposer disabled={loading || sending || !chatSessionId} onSend={sendMessage} />
                </div>
                <p className="mt-3 text-center text-[11px] text-[#9b8772]">
                  AI bisa bantu pilih paket, tetapi stok dan ongkir tetap mengikuti data toko.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function OpeningScreen({
  loading,
  error,
  onStart,
}: {
  loading: boolean;
  error: string;
  onStart: () => void;
}) {
  return (
    <div className="relative flex h-full min-h-screen items-center justify-center overflow-hidden px-5 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_14%,rgba(214,162,74,0.18),transparent_26%),radial-gradient(circle_at_50%_92%,rgba(111,138,58,0.10),transparent_24%)]" />
      <div className="pointer-events-none absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full bg-[#fff2d7]/60 blur-3xl" />

      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center text-center"
      >
        <motion.div
          animate={{ y: [0, -7, 0], rotate: [0, -1.5, 0] }}
          transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut' }}
          className="mb-6 grid h-16 w-16 place-items-center rounded-[1.8rem] bg-[#6b4423] text-white shadow-[0_22px_60px_rgba(107,68,35,0.22)]"
        >
          <Sparkles size={28} />
        </motion.div>

        <div className="mb-5 flex items-center gap-2 rounded-full border border-[#eadfce] bg-[#fffaf3]/88 px-4 py-2 text-xs font-medium text-[#6f5d4f] shadow-[0_10px_28px_rgba(47,36,28,0.06)] backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-[#7a963a]" />
          AI ordering siap bantu dari pilih rasa sampai checkout
        </div>

        <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.07em] text-[#2f241c] md:text-6xl">
          Pesan keripik lewat chat
          <br className="hidden md:block" /> yang terasa lebih natural.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-[#6f5d4f] md:text-lg">
          Sambutan dibuat lebih simpel, fokus langsung ke percakapan. Kamu bisa mulai dari rekomendasi rasa, stok, paket warung, atau cek pesanan lama.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onStart}
            disabled={loading}
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#111111] px-6 py-3.5 text-sm font-medium text-white shadow-[0_18px_48px_rgba(17,17,17,0.16)] transition hover:bg-[#222222] disabled:cursor-not-allowed disabled:bg-[#cec2b2]"
          >
            {loading ? 'Menyiapkan chat...' : 'Mulai pesan'}
            <ArrowRight size={17} className="transition group-hover:translate-x-0.5" />
          </button>
          <a
            href="/pesan/lacak"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#eadfce] bg-[#fffaf3]/90 px-6 py-3.5 text-sm font-medium text-[#2f241c] shadow-[0_10px_28px_rgba(47,36,28,0.05)] transition hover:bg-[#ffffff]"
          >
            <PackageSearch size={17} />
            Lacak pesanan
          </a>
        </div>

        <div className="mt-14 w-full max-w-3xl rounded-[2rem] border border-[#eadfce] bg-[rgba(255,251,245,0.72)] p-3 shadow-[0_24px_70px_rgba(47,36,28,0.08)] backdrop-blur-2xl">
          <div className="flex items-center gap-3 rounded-[1.6rem] px-3 py-2 text-left">
            <div className="grid h-11 w-11 place-items-center rounded-full text-[#6f5d4f]">
              <Sparkles size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] text-[#9b8772]">Tanya stok, harga, atau tulis pesananmu...</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-full bg-[#111111] text-white shadow-[0_12px_28px_rgba(17,17,17,0.16)]">
              <ArrowRight size={18} />
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-[#6f5d4f]">
          <span className="rounded-full bg-[#f4ead9] px-4 py-2">Rekomendasi rasa otomatis</span>
          <span className="rounded-full bg-[#f4ead9] px-4 py-2">Checkout lebih ringkas</span>
          <span className="rounded-full bg-[#f4ead9] px-4 py-2">Riwayat chat bisa dibuka lagi</span>
        </div>

        {error && (
          <p className="mt-5 rounded-[1.4rem] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="mt-12 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
          {[
            { icon: <ShoppingBag size={16} />, title: 'Paket favorit', body: 'Mulai dari best seller untuk ngemil atau stok warung.' },
            { icon: <ShieldCheck size={16} />, title: 'Alur lebih aman', body: 'Status pesanan dan pembayaran tetap jelas dan mudah dilacak.' },
            { icon: <Sparkles size={16} />, title: 'Terasa premium', body: 'Komposer melayang, respons ringan, dan layout tidak ramai.' },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-[1.6rem] border border-[#eadfce] bg-[#fffaf3]/80 p-4 text-left shadow-[0_16px_36px_rgba(47,36,28,0.05)] backdrop-blur"
            >
              <div className="mb-3 grid h-10 w-10 place-items-center rounded-2xl bg-[#f4ead9] text-[#6b4423]">
                {item.icon}
              </div>
              <p className="text-sm font-semibold text-[#2f241c]">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-[#756252]">{item.body}</p>
            </div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
