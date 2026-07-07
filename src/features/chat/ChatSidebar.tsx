'use client';

import { useAutoAnimate } from '@formkit/auto-animate/react';
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  LifeBuoy,
  MessageSquarePlus,
  PackageSearch,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

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

type SidebarItemProps = {
  icon: React.ReactNode;
  label: string;
  href?: string;
  badge?: string | number;
  active?: boolean;
  compact?: boolean;
  onClick?: () => void;
};

function SidebarItem({
  icon,
  label,
  href,
  badge,
  active,
  compact,
  onClick,
}: SidebarItemProps) {
  const className = `group flex items-center gap-3 rounded-[1.1rem] px-2.5 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c55a2b]/15 ${
    active
      ? 'bg-[#fff9f2] text-[#2f241c] shadow-[0_10px_26px_rgba(47,36,28,0.06)]'
      : 'text-[#715f50] hover:bg-[#f9efe0] hover:text-[#2f241c]'
  } ${compact ? 'justify-center px-2' : ''}`;

  const content = (
    <>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${active ? 'bg-[#fde8d9] text-[#c55a2b]' : 'bg-transparent text-current group-hover:bg-[#f3e7d8]'}`}>
        {icon}
      </span>
      {!compact && (
        <>
          <span className="flex-1">{label}</span>
          {badge !== undefined && badge !== 0 && (
            <span className="rounded-full bg-[#c55a2b] px-2 py-0.5 text-[11px] font-semibold text-white">
              {badge}
            </span>
          )}
        </>
      )}
    </>
  );

  const element = href ? (
    <a href={href} className={className} onClick={onClick}>
      {content}
    </a>
  ) : (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  );

  if (!compact) return element;
  return <div title={label}>{element}</div>;
}

export function ChatSidebar({
  sessions,
  activeId,
  cartCount,
  compact = false,
  mobile = false,
  onNewOrder,
  onSelectSession,
  onToggleCompact,
  loadingSessionId,
}: {
  sessions: ChatSessionSummary[];
  activeId?: string;
  cartCount: number;
  compact?: boolean;
  mobile?: boolean;
  onNewOrder?: () => void;
  onSelectSession?: (sessionId: string) => void;
  onToggleCompact?: () => void;
  loadingSessionId?: string | null;
}) {
  const [historyRef] = useAutoAnimate<HTMLDivElement>();

  return (
    <aside
      className={`flex h-full flex-col border-r border-[#f0dfca] bg-[linear-gradient(180deg,rgba(255,252,247,0.96)_0%,rgba(248,240,229,0.9)_100%)] px-2.5 py-4 text-[#2f241c] backdrop-blur-xl ${
        compact ? 'items-center' : ''
      }`}
    >
      <div className={`flex items-center ${compact ? 'w-full flex-col gap-3' : 'justify-between gap-3 px-1'}`}>
        <div className={`flex items-center gap-3 ${compact ? 'flex-col' : ''}`}>
          <div className="relative grid h-11 w-11 place-items-center rounded-[1.3rem] bg-[#c55a2b] text-sm font-semibold text-white shadow-[0_18px_40px_rgba(197,90,43,0.24)]">
            RK
            <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#7f9f3e] text-[10px] text-white">
              <Sparkles size={10} />
            </span>
          </div>
          {!compact && (
            <div>
              <p className="text-sm font-semibold tracking-[-0.02em] text-[#2f241c]">Rumah Keripik AI</p>
              <p className="text-xs text-[#7c6858]">Percakapan, keranjang, dan lacak pesanan</p>
            </div>
          )}
        </div>

        {!mobile && (
          <button
            type="button"
            onClick={onToggleCompact}
            className="grid h-9 w-9 place-items-center rounded-2xl text-[#786455] transition hover:bg-[#f3ebdc] hover:text-[#2f241c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c55a2b]/15"
            aria-label={compact ? 'Buka sidebar' : 'Ciutkan sidebar'}
          >
            {compact ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
        )}
      </div>

      <div className={`mt-5 grid w-full gap-1.5 ${compact ? 'justify-items-center' : ''}`}>
        <SidebarItem icon={<MessageSquarePlus size={17} />} label="Pesanan baru" active={!activeId} compact={compact} onClick={onNewOrder} />
        <SidebarItem icon={<PackageSearch size={17} />} label="Lacak pesanan" href="/pesan/lacak" compact={compact} />
        <SidebarItem icon={<ShoppingBag size={17} />} label="Keranjang" href="#chat-cart" badge={cartCount} compact={compact} />
        <SidebarItem icon={<LifeBuoy size={17} />} label="Bantuan" href="#bantuan" compact={compact} />
      </div>

      {!compact && (
        <div className="mt-5 rounded-[1.5rem] border border-[#f0dfca] bg-[#fffaf3]/92 px-3 py-3 shadow-[0_14px_34px_rgba(47,36,28,0.04)]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#a08973]">Riwayat chat</p>
            <span className="text-[11px] text-[#9b8772]">{sessions.length}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-[#776454]">
            Percakapan sebelumnya tersimpan di sini.
          </p>
        </div>
      )}

      <div className={`mt-4 min-h-0 flex-1 ${compact ? 'w-full' : ''}`}>
        {compact ? (
          <div className="flex flex-col items-center gap-2">
            {sessions.slice(0, 3).map((session) => (
              <div key={session.id} title={session.title || 'Pesanan Baru'}>
                <button
                  type="button"
                  onClick={() => onSelectSession?.(session.id)}
                  disabled={loadingSessionId === session.id}
                  className={`grid h-10 w-10 place-items-center rounded-2xl text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c55a2b]/15 ${
                    activeId === session.id
                      ? 'bg-[#fff9f2] text-[#c55a2b] shadow-[0_12px_24px_rgba(197,90,43,0.10)]'
                      : 'text-[#816f60] hover:bg-[#fbf1e4]'
                  } ${loadingSessionId === session.id ? 'cursor-wait opacity-70' : ''}`}
                >
                  {(session.title || 'P').slice(0, 1).toUpperCase()}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="relative h-full">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-[linear-gradient(180deg,rgba(248,240,229,1)_0%,rgba(248,240,229,0)_100%)]" />
            <div
              ref={historyRef}
              className="h-full overflow-y-auto pr-2 scrollbar-thin [scrollbar-color:#ccaf8f_transparent]"
            >
              <div className="space-y-2 pb-8 pt-2">
                {sessions.length === 0 ? (
                  <p className="rounded-[1.3rem] border border-dashed border-[#e3cfb6] bg-[#fffaf3] p-4 text-sm leading-6 text-[#776454]">
                    Belum ada riwayat lain.
                  </p>
                ) : (
                  sessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => onSelectSession?.(session.id)}
                      disabled={loadingSessionId === session.id}
                      className={`w-full rounded-[1.35rem] px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c55a2b]/15 ${
                        activeId === session.id
                          ? 'bg-[#fff9f2] shadow-[0_12px_26px_rgba(197,90,43,0.08)]'
                          : 'hover:bg-[#fbf1e4]'
                      } ${loadingSessionId === session.id ? 'cursor-wait opacity-70' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold tracking-[-0.02em] text-[#2f241c]">
                            {session.title || 'Pesanan Baru'}
                          </p>
                          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[#927d6a]">
                            <span className="rounded-full bg-[#fde8d9] px-2 py-0.5 font-medium text-[#c55a2b]">
                              {statusLabel(session.status)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock3 size={12} />
                              {formatSessionTime(session.updatedAt)}
                            </span>
                          </div>
                        </div>
                        {activeId === session.id && (
                          <span className="rounded-full bg-[#c55a2b] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                            Live
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-[linear-gradient(180deg,rgba(248,240,229,0)_0%,rgba(248,240,229,1)_100%)]" />
          </div>
        )}
      </div>
    </aside>
  );
}
