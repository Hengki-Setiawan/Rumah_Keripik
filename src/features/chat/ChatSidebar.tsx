'use client';

import { Clock3, LifeBuoy, MessageSquarePlus, PackageSearch, ShoppingBag } from 'lucide-react';

export type ChatSessionSummary = {
  id: string;
  title: string | null;
  status: string;
  updatedAt: string;
};

function formatSessionTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Waktu belum tersedia';

  const now = new Date();
  const isSameDay = date.toDateString() === now.toDateString();

  if (isSameDay) {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function statusLabel(status: string) {
  switch (status) {
    case 'needs_admin':
      return 'Perlu admin';
    case 'closed':
      return 'Selesai';
    case 'archived':
      return 'Arsip';
    case 'active':
    default:
      return 'Aktif';
  }
}

export function ChatSidebar({
  sessions,
  activeId,
  cartCount,
  onNewOrder,
  onSelectSession,
  loadingSessionId,
}: {
  sessions: ChatSessionSummary[];
  activeId?: string;
  cartCount: number;
  onNewOrder?: () => void;
  onSelectSession?: (sessionId: string) => void;
  loadingSessionId?: string | null;
}) {
  return (
    <aside className="flex h-full flex-col border-r border-[#e8dcc9] bg-[linear-gradient(180deg,#fff9f1_0%,#f6efe4_100%)] p-3 text-[#2f241c]">
      <div className="mb-4 rounded-[1.4rem] border border-[#e8dcc9] bg-[#fffdf8] px-3 py-3 shadow-[0_10px_24px_rgba(47,36,28,0.05)]">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#6b4423] text-sm font-semibold text-white shadow-[0_10px_24px_rgba(107,68,35,0.16)]">RK</div>
          <div>
            <p className="text-sm font-semibold tracking-[0.12em] text-[#2f241c]">RUMAH KERIPIK</p>
            <p className="text-xs text-[#6b5a4d]">Asisten pemesanan</p>
          </div>
        </div>
      </div>

      <div className="grid gap-1.5 text-sm font-medium">
        <button onClick={onNewOrder} className="flex items-center gap-2 rounded-xl border border-[#e8dcc9] bg-[#fffdf8] px-3 py-2.5 text-left text-[#2f241c] shadow-[0_6px_18px_rgba(47,36,28,0.04)] transition hover:bg-[#f3ebdc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4423]/20">
          <MessageSquarePlus size={17} /> Pesanan Baru
        </button>
        <a href="/pesan/lacak" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[#5a4a3c] transition hover:bg-[#f3ebdc] hover:text-[#2f241c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4423]/20">
          <PackageSearch size={17} /> Lacak Pesanan
        </a>
        <a href="#chat-cart" className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[#5a4a3c] transition hover:bg-[#f3ebdc] hover:text-[#2f241c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4423]/20">
          <span className="flex items-center gap-2"><ShoppingBag size={17} /> Keranjang</span>
          <span className="rounded-full bg-[#6b4423] px-2 py-0.5 text-xs text-white">{cartCount}</span>
        </a>
        <a href="#bantuan" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[#5a4a3c] transition hover:bg-[#f3ebdc] hover:text-[#2f241c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4423]/20">
          <LifeBuoy size={17} /> Bantuan
        </a>
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto scrollbar-thin scrollbar-gutter-stable pr-1">
        <div className="mb-3 px-2">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#a08973]">Riwayat chat</p>
          <p className="mt-1 text-[11px] text-[#9b846d]">Buka lagi pesanan sebelumnya tanpa mulai dari awal.</p>
        </div>
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#d9ccb9] bg-[#fffdf8] p-4 text-sm text-[#6b5a4d]">Belum ada riwayat lain.</p>
          ) : sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => onSelectSession?.(session.id)}
              disabled={loadingSessionId === session.id}
              className={`w-full rounded-[1.35rem] border px-3.5 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4423]/20 ${
                activeId === session.id
                  ? 'border-[#dfcfb8] bg-[linear-gradient(180deg,#f3e7d3_0%,#efe2cb_100%)] text-[#2f241c] shadow-[0_10px_26px_rgba(107,68,35,0.08)]'
                  : 'border-transparent bg-transparent text-[#5a4a3c] hover:border-[#eadbc8] hover:bg-[#fbf4e9]'
              } ${loadingSessionId === session.id ? 'cursor-wait opacity-70' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold tracking-[-0.01em]">{session.title || 'Pesanan Baru'}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[#8f7862]">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${
                      activeId === session.id ? 'bg-[#fff8ec] text-[#6b4423]' : 'bg-[#f3ebdc] text-[#7b654f]'
                    }`}>
                      {statusLabel(session.status)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 size={12} />
                      {formatSessionTime(session.updatedAt)}
                    </span>
                  </div>
                </div>
                {activeId === session.id && (
                  <span className="mt-0.5 rounded-full bg-[#6b4423] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                    Aktif
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
