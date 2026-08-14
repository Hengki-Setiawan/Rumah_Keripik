'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { CheckCircle2, LayoutDashboard, Menu, MessageSquare, PackageSearch, Rocket, Sparkles, XCircle, X } from 'lucide-react';
import type { ChatCartDto, ChatMessageDto } from '@/lib/chat-v3/types';
import { ChatComposer } from './ChatComposer';
import { ChatSidebar, type ChatSessionSummary } from './ChatSidebar';
import { ChatWindow } from './ChatWindow';

function isGreetingMessage(msg: ChatMessageDto): boolean {
  if (msg.metadata?.greeting) return true;
  if (msg.metadata?.intent === 'small_talk') return true;
  const c = msg.content || '';
  if (c.includes('Selamat datang di Rumah Keripik!')) return true;
  if (c.includes('Mau pesan keripik apa hari ini?')) return true;
  if (c.includes('Mau pesan lagi hari ini?')) return true;
  return false;
}

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
  const [stage, setStage] = useState<string>('idle');
  const [draft, setDraft] = useState('');


  // Sesi lama yang bisa di-resume — ditampilkan sebagai chip elegan
  const [resumableSession, setResumableSession] = useState<{ id: string; preview: string } | null>(null);
  // Session ID yang sudah siap dipakai (diinisialisasi) tapi belum "started"
  const pendingSessionIdRef = useRef<string>('');

  const loadSessions = useCallback(async () => {
    const response = await fetch('/api/chat/sessions');
    const data = await response.json();
    const loadedSessions = data.ok ? (data.sessions || []) : [];
    if (data.ok) setSessions(loadedSessions);
    return loadedSessions as ChatSessionSummary[];
  }, []);

  /**
   * Bootstrap: siapkan sesi di background.
   * TIDAK memuat pesan lama ke layar dan TIDAK memicu auto-greeting.
   * Hero tetap tampil sampai user berinteraksi.
   */
  async function bootstrap(forceNew = false) {
    setLoading(true);
    const response = await fetch('/api/customer/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forceNew }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Session gagal');

    const sessionMessages: ChatMessageDto[] = data.messages || [];
    const sessionCart: ChatCartDto | null = data.cart || null;

    pendingSessionIdRef.current = data.chatSession.id;
    setChatSessionId(data.chatSession.id);
    setCart(sessionCart);
    setStage(data.chatSession.stage || 'idle');
    setLoading(false);
    loadSessions().catch(() => undefined);

    // Jika ada sesi lama dengan pesan (bukan greeting), tawarkan sebagai chip "Lanjutkan"
    const realMessages = sessionMessages.filter((msg) => !isGreetingMessage(msg));
    if (realMessages.length > 0 && !forceNew) {
      const lastMsg = realMessages[realMessages.length - 1];
      const preview = lastMsg?.content?.slice(0, 60) || 'Chat sebelumnya';
      setResumableSession({ id: data.chatSession.id, preview });
    }

    return data.chatSession.id as string;
  }

  async function ensureSession(forceNew = false): Promise<string> {
    if (pendingSessionIdRef.current && !forceNew) return pendingSessionIdRef.current;
    return bootstrap(forceNew);
  }

  /** User memilih "Mulai Baru" — kembali ke hero, user yang mulai duluan */
  async function startNewOrder() {
    setError('');
    setResumableSession(null);
    setMessages([]);
    setCart(null);
    setStarted(false);
    try {
      await bootstrap(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat belum bisa dimuat. Coba refresh halaman.');
      setLoading(false);
    }
  }

  /** User mengklik chip "Lanjutkan Chat" */
  async function resumeSession() {
    if (!resumableSession) return;
    setResumableSession(null);
    await openSession(resumableSession.id);
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
      pendingSessionIdRef.current = nextSessionId;
      setChatSessionId(nextSessionId);
      setMessages(data.messages || []);
      setCart(data.cart || null);
      setStarted((data.messages || []).length > 0);
      setStage(data.stage || 'idle');
      setSidebarOpen(false);
      setResumableSession(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Riwayat chat gagal dibuka');
    } finally {
      if (!silent) setSessionLoadingId(null);
    }
  }

  // Auto-bootstrap saat halaman pertama kali dibuka
  useEffect(() => {
    bootstrap(false).catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/chat/sessions')
      .then((r) => r.json())
      .then((data) => { if (!cancelled && data.ok) setSessions(data.sessions || []); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const sinceRef = useRef<string>('');

  // Polling hanya aktif setelah user memulai chat
  useEffect(() => {
    if (!chatSessionId || !started) return;
    let cancelled = false;

    async function poll() {
      try {
        const params = `chatSessionId=${encodeURIComponent(chatSessionId!)}${sinceRef.current ? `&since=${encodeURIComponent(sinceRef.current)}` : ''}`;
        const res = await fetch(`/api/chat/poll?${params}`);
        const data = await res.json();
        if (!cancelled && data.ok && data.changed) {
          setMessages(data.messages || []);
          setCart(data.cart || null);
          const last = data.messages?.[data.messages.length - 1];
          if (last?.createdAt) sinceRef.current = last.createdAt;
        }
      } catch {
        // silently retry
      }
    }

    poll();
    const timer = setInterval(poll, 3_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [chatSessionId, started]);

  async function sendMessage(text: string) {
    setSending(true);
    setError('');

    try {
      const sessionId = pendingSessionIdRef.current || await ensureSession(false);
      setStarted(true);
      setResumableSession(null);

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
      setStage(data.response?.stage || data.stage || 'idle');
      loadSessions().catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pesan gagal dikirim');
    } finally {
      setSending(false);
      setLoading(false);
    }
  }

  async function runAction(action: string, payload: Record<string, unknown> = {}) {
    if (action.startsWith('/')) { window.location.href = action; return; }
    if (/^https?:\/\//i.test(action)) { window.location.href = action; return; }

    setSending(true);
    setError('');

    try {
      const sessionId = pendingSessionIdRef.current || await ensureSession(false);
      setStarted(true);
      setResumableSession(null);

      const response = await fetch('/api/chat/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatSessionId: sessionId, action, payload }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Aksi gagal');
      setMessages(data.messages || []);
      setCart(data.cart || null);
      setStarted(true);
      setStage(data.stage || 'idle');
      loadSessions().catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aksi gagal');
    } finally {
      setSending(false);
      setLoading(false);
    }
  }

  async function deleteSession(sessionId: string) {
    setError('');
    try {
      const response = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Riwayat chat gagal dihapus');
      setSessions((current) => current.filter((item) => item.id !== sessionId));
      if (chatSessionId === sessionId) {
        pendingSessionIdRef.current = '';
        setChatSessionId('');
        setMessages([]);
        setCart(null);
        setStarted(false);
        setResumableSession(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Riwayat chat gagal dihapus');
    }
  }

  async function clearSessions() {
    setError('');
    try {
      const response = await fetch('/api/chat/sessions', { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Riwayat chat gagal dihapus');
      setSessions([]);
      pendingSessionIdRef.current = '';
      setChatSessionId('');
      setMessages([]);
      setCart(null);
      setStarted(false);
      setSidebarOpen(false);
      setResumableSession(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Riwayat chat gagal dihapus');
    }
  }

  const displayMessages = useMemo(() => {
    return messages.filter((msg) => !isGreetingMessage(msg));
  }, [messages]);

  const isIdle = !started && displayMessages.length === 0 && !loading && !sending;

  return (
    <main className="h-[100dvh] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(240,180,41,0.18),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(127,159,62,0.10),transparent_20%),linear-gradient(180deg,#faf6ef_0%,#fffaf4_100%)] text-[#2f241c]">
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
          <header className="flex flex-wrap items-center justify-between gap-2 px-2 pb-0.5 pt-2 md:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                data-testid="header-menu-toggle"
                className="grid h-8 w-8 place-items-center rounded-xl border border-[#f0dfca] bg-[#fffaf3]/80 text-[#6f5d4f] transition hover:text-[#2f241c] lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={15} />
              </button>
              <div className="flex items-center gap-2 min-w-0">
                <BrandLogo variant="mark" className="h-7 w-7 rounded-lg object-contain shrink-0" priority />
                <span className="truncate text-sm font-semibold text-[#2f241c]">Rumah Keripik</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <a
                href="/pesan/saya"
                data-testid="header-my-orders"
                className="grid h-8 w-8 place-items-center rounded-xl text-[#6f5d4f] transition hover:bg-[#f7eddf] hover:text-[#2f241c]"
                aria-label="Pesanan saya"
              >
                <PackageSearch size={15} />
              </a>
              <Link
                href="/login"
                data-testid="header-admin-link"
                className="grid h-8 w-8 place-items-center rounded-xl text-[#6f5d4f] transition hover:bg-[#f7eddf] hover:text-[#2f241c]"
                aria-label="Admin"
              >
                <LayoutDashboard size={15} />
              </Link>
              <button
                type="button"
                data-testid="header-new-order"
                onClick={startNewOrder}
                className="flex h-8 items-center gap-1.5 rounded-xl bg-[#c55a2b] px-2.5 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(197,90,43,0.14)] transition hover:bg-[#ae4d23]"
              >
                <Sparkles size={13} />
                Baru
              </button>
            </div>
          </header>

          {error && (
            <div className="mx-4 mt-2 rounded-[1.35rem] border border-red-200 bg-red-50/90 px-4 py-3 text-sm font-medium text-red-700 md:mx-6">
              {error}
            </div>
          )}

          {/* Chip "Lanjutkan Chat" — muncul elegan saat ada sesi lama */}
          <AnimatePresence>
            {isIdle && resumableSession && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="mx-4 mt-2 flex items-center gap-3 rounded-2xl border border-[#f0dfca] bg-[rgba(255,250,244,0.95)] px-4 py-2.5 shadow-[0_4px_14px_rgba(47,36,28,0.06)] backdrop-blur md:mx-6"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#c55a2b]/10 text-[#c55a2b]">
                  <MessageSquare size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#2f241c]">Ada chat sebelumnya</p>
                  <p className="truncate text-[11px] text-[#9b8772]">{resumableSession.preview}…</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setResumableSession(null)}
                    className="rounded-lg px-2.5 py-1 text-xs text-[#9b8772] transition hover:text-[#6f5d4f]"
                  >
                    Abaikan
                  </button>
                  <button
                    type="button"
                    onClick={resumeSession}
                    className="rounded-lg bg-[#c55a2b] px-3 py-1 text-xs font-semibold text-white transition hover:bg-[#ae4d23]"
                  >
                    Lanjutkan →
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative flex min-h-0 flex-1 flex-col">
            <ChatWindow
              messages={displayMessages}
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
                    <ChatComposer
                      disabled={loading || sending}
                      value={draft}
                      onValueChange={setDraft}
                      onSend={sendMessage}
                      idle
                    />
                  </motion.div>
                ) : null
              }
            />

            {!isIdle && (
              <div className="pointer-events-none sticky bottom-0 z-10 mt-auto bg-[linear-gradient(180deg,rgba(255,250,244,0)_0%,rgba(255,250,244,0.72)_22%,rgba(255,250,244,0.98)_62%,rgba(255,250,244,1)_100%)] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-7 md:px-5 md:pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, ease: 'easeOut' }}
                  className="mx-auto max-w-3xl"
                >
                <div className="pointer-events-auto">
                  {['completed', 'cancelled'].includes(stage) ? (
                    <div className="mb-3 rounded-[1.5rem] border border-[#f0dfca] bg-[#fffaf3] p-4 text-center shadow-[0_12px_28px_rgba(47,36,28,0.06)]">
                      <p className="mb-2 flex items-center justify-center gap-1.5 text-sm font-semibold text-[#2f241c]">
                        {stage === 'completed' 
                          ? <><CheckCircle2 size={16} className="text-[#7f9f3e]" /> Pesanan kakak sudah selesai diproses!</> 
                          : <><XCircle size={16} className="text-[#c55a2b]" /> Pesanan kakak telah dibatalkan.</>}
                      </p>
                      <p className="text-xs text-[#6f5d4f] mb-3">
                        Mau memesan keripik lezat lainnya? Mulai sesi baru sekarang.
                      </p>
                      <button
                        type="button"
                        onClick={startNewOrder}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#7f9f3e] px-6 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(127,159,62,0.18)] transition hover:bg-[#6a8932]"
                      >
                        <Rocket size={15} /> Buat Pesanan Baru
                      </button>
                    </div>
                  ) : (
                    <ChatComposer
                      disabled={loading || sending || !chatSessionId}
                      value={draft}
                      onValueChange={setDraft}
                      onSend={sendMessage}
                    />
                  )}
                </div>
                </motion.div>
              </div>
            )}
          </div>
        </section>
      </div>

      <footer className="border-t border-outline-variant/30 bg-white/60 px-4 py-2 text-center">
        <p className="text-[10px] leading-relaxed text-on-surface-variant/60">
          Dengan menggunakan chat ini, Anda menyadari bahwa pesan diproses oleh AI pihak ketiga (Groq, Google Gemini).
          Data pribadi (nomor HP, alamat, koordinat) telah diredaksi sebelum dikirim ke penyedia AI.
          Lihat{' '}
          <Link href="/kebijakan-privasi" className="underline hover:text-primary">
            Kebijakan Privasi
          </Link>{' '}
          untuk informasi selengkapnya.
        </p>
      </footer>
    </main>
  );
}
