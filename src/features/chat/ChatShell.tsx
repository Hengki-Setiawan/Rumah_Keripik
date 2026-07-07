'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { LayoutDashboard, Menu, PackageSearch, Sparkles, X } from 'lucide-react';
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

  const loadSessions = useCallback(async () => {
    const response = await fetch('/api/chat/sessions');
    const data = await response.json();
    const loadedSessions = data.ok ? (data.sessions || []) : [];
    if (data.ok) setSessions(loadedSessions);
    return loadedSessions as ChatSessionSummary[];
  }, []);

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
    return data.chatSession.id as string;
  }

  async function ensureSession(forceNew = false) {
    if (chatSessionId && !forceNew) return chatSessionId;
    return bootstrap(forceNew);
  }

  async function startNewOrder() {
    setError('');
    try {
      await ensureSession(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat belum bisa dimuat. Coba refresh halaman.');
      setLoading(false);
    }
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

  const refreshChatState = useCallback(async () => {
    if (!chatSessionId) return;
    const response = await fetch(`/api/chat/state?chatSessionId=${encodeURIComponent(chatSessionId)}`);
    const data = await response.json();
    if (!response.ok || !data.ok) return;
    setMessages(data.messages || []);
    setCart(data.cart || null);
    loadSessions().catch(() => undefined);
  }, [chatSessionId, loadSessions]);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/chat/sessions')
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || !data.ok) return;
        setSessions(data.sessions || []);
      })
      .catch(() => undefined);

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
        // Ignore malformed payloads.
      }
    });
    source.onerror = () => source.close();
    return () => source.close();
  }, [chatSessionId]);

  useEffect(() => {
    if (!chatSessionId || sending) return;
    const timer = window.setInterval(() => {
      refreshChatState().catch(() => undefined);
    }, 12000);
    return () => window.clearInterval(timer);
  }, [chatSessionId, refreshChatState, sending]);

  async function sendMessage(text: string) {
    setSending(true);
    setError('');

    try {
      const sessionId = await ensureSession(isIdle);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatSessionId: sessionId, message: text }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Pesan gagal dikirim');
      setMessages(data.messages || []);
      setCart(data.cart || null);
      setStarted(true);
      loadSessions().catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pesan gagal dikirim');
    } finally {
      setSending(false);
      setLoading(false);
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

  async function deleteSession(sessionId: string) {
    setError('');
    try {
      const response = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Riwayat chat gagal dihapus');

      setSessions((current) => current.filter((item) => item.id !== sessionId));
      if (chatSessionId === sessionId) {
        setChatSessionId('');
        setMessages([]);
        setCart(null);
        setStarted(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Riwayat chat gagal dihapus');
    }
  }

  async function clearSessions() {
    setError('');
    try {
      const response = await fetch('/api/chat/sessions', {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Riwayat chat gagal dihapus');

      setSessions([]);
      setChatSessionId('');
      setMessages([]);
      setCart(null);
      setStarted(false);
      setSidebarOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Riwayat chat gagal dihapus');
    }
  }

  const isIdle = !started && messages.length === 0 && !loading && !sending;

  return (
    <main className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(240,180,41,0.18),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(127,159,62,0.10),transparent_20%),linear-gradient(180deg,#faf6ef_0%,#fffaf4_100%)] text-[#2f241c]">
      <div className="flex h-full">
        <motion.div
          animate={{ width: sidebarCollapsed ? 64 : 232 }}
          transition={{ type: 'spring', stiffness: 280, damping: 30 }}
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
            onQuickAction={runAction}
            onDeleteSession={deleteSession}
            onClearSessions={clearSessions}
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
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
              <motion.div
                initial={{ x: -24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -24, opacity: 0 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className="absolute inset-y-0 left-0 w-[232px] max-w-[82vw]"
              >
                <ChatSidebar
                  sessions={sessions}
                  activeId={chatSessionId}
                  cartCount={cart?.itemCount || 0}
                  mobile
                  onNewOrder={startNewOrder}
                  onSelectSession={openSession}
                  onQuickAction={runAction}
                  onDeleteSession={deleteSession}
                  onClearSessions={clearSessions}
                  loadingSessionId={sessionLoadingId}
                />
              </motion.div>
              <button
                type="button"
                className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-[#f0dfca] bg-[#fffaf3] text-[#2f241c] shadow-[0_10px_30px_rgba(47,36,28,0.12)]"
                onClick={() => setSidebarOpen(false)}
              >
                <X size={18} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between px-4 pb-1 pt-3 md:px-5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-full border border-[#f0dfca] bg-[#fffaf3]/90 text-[#6f5d4f] shadow-[0_8px_18px_rgba(47,36,28,0.05)] transition hover:text-[#2f241c] lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={16} />
              </button>
              <div className="hidden md:block">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#9a8672]">AI Workspace</p>
                <h1 className="mt-0.5 text-base font-semibold tracking-[-0.03em] text-[#2f241c]">Rumah Keripik AI</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full border border-[#f0dfca] bg-[#fffaf3]/92 px-3.5 py-2 text-sm font-medium text-[#6f5d4f] shadow-[0_8px_18px_rgba(47,36,28,0.04)] transition hover:bg-white hover:text-[#2f241c]"
              >
                <LayoutDashboard size={15} />
                <span className="hidden sm:inline">Admin</span>
              </Link>
              <a
                href="/pesan/lacak"
                className="inline-flex items-center gap-2 rounded-full border border-[#f0dfca] bg-[#fffaf3]/92 px-3.5 py-2 text-sm font-medium text-[#2f241c] shadow-[0_8px_18px_rgba(47,36,28,0.04)] transition hover:bg-white"
              >
                <PackageSearch size={15} />
                <span className="hidden sm:inline">Lacak</span>
              </a>
              <button
                type="button"
                onClick={startNewOrder}
                className="inline-flex items-center gap-2 rounded-full bg-[#c55a2b] px-3.5 py-2 text-sm font-medium text-white shadow-[0_12px_24px_rgba(197,90,43,0.16)] transition hover:bg-[#ae4d23]"
              >
                <Sparkles size={14} />
                <span className="hidden sm:inline">Chat baru</span>
              </button>
            </div>
          </header>

          {error && (
            <div className="mx-4 mt-2 rounded-[1.35rem] border border-red-200 bg-red-50/90 px-4 py-3 text-sm font-medium text-red-700 md:mx-6">
              {error}
            </div>
          )}

          <div className="relative flex min-h-0 flex-1 flex-col">
            <ChatWindow
              messages={messages}
              cart={cart}
              loading={loading || sending}
              idle={isIdle}
              onSend={sendMessage}
              onAction={runAction}
              footerSlot={
                isIdle ? (
                  <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.42, ease: 'easeOut', delay: 0.08 }}
                    className="mx-auto mt-8 w-full max-w-4xl"
                  >
                    <ChatComposer disabled={loading || sending} onSend={sendMessage} idle />
                  </motion.div>
                ) : null
              }
            />

            {!isIdle && (
              <div className="pointer-events-none sticky bottom-0 z-10 mt-auto bg-[linear-gradient(180deg,rgba(255,250,244,0)_0%,rgba(255,250,244,0.72)_22%,rgba(255,250,244,0.98)_62%,rgba(255,250,244,1)_100%)] px-3 pb-3 pt-7 md:px-5 md:pb-4">
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, ease: 'easeOut' }}
                  className="mx-auto max-w-3xl"
                >
                  <div className="pointer-events-auto">
                    <ChatComposer disabled={loading || sending || !chatSessionId} onSend={sendMessage} />
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
