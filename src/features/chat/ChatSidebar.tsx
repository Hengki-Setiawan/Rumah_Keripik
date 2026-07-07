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
  const className = `group flex items-center gap-3 rounded-[1.15rem] px-3 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4423]/15 ${
    active
      ? 'bg-[#fffaf2] text-[#2f241c] shadow-[0_10px_30px_rgba(47,36,28,0.07)]'
      : 'text-[#715f50] hover:bg-[#f8f0e1] hover:text-[#2f241c]'
  } ${compact ? 'justify-center px-2.5' : ''}`;

  const content = (
    <>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${active ? 'bg-[#f4ead9] text-[#6b4423]' : 'bg-transparent text-current group-hover:bg-[#f2e7d5]'}`}>
        {icon}
      </span>
      {!compact && (
        <>
          <span className="flex-1">{label}</span>
          {badge !== undefined && badge !== 0 && (
            <span className="rounded-full bg-[#6b4423] px-2 py-0.5 text-[11px] font-semibold text-white">
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
      className={`flex h-full flex-col border-r border-[#eadfce] bg-[linear-gradient(180deg,rgba(255,252,247,0.94)_0%,rgba(247,239,228,0.88)_100%)] px-3 py-4 text-[#2f241c] backdrop-blur-xl ${
        compact ? 'items-center' : ''
      }`}
    >
      <div className={`flex items-center ${compact ? 'w-full flex-col gap-3' : 'justify-between gap-3 px-1'}`}>
        <div className={`flex items-center gap-3 ${compact ? 'flex-col' : ''}`}>
          <div className="relative grid h-11 w-11 place-items-center rounded-[1.35rem] bg-[#6b4423] text-sm font-semibold text-white shadow-[0_18px_40px_rgba(107,68,35,0.24)]">
            RK
            <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#7a963a] text-[10px] text-white">
              <Sparkles size={10} />
            </span>
          </div>
          {!compact && (
            <div>
              <p className="text-sm font-semibold tracking-[-0.02em] text-[#2f241c]">Rumah Keripik AI</p>
              <p className="text-xs text-[#7c6858]">Workspace pemesanan yang rapi</p>
            </div>
          )}
        </div>

        {!mobile && (
          <button
            type="button"
            onClick={onToggleCompact}
            className="grid h-10 w-10 place-items-center rounded-2xl text-[#786455] transition hover:bg-[#f3ebdc] hover:text-[#2f241c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4423]/15"
            aria-label={compact ? 'Buka sidebar' : 'Ciutkan sidebar'}
          >
            {compact ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        )}
      </div>

      <div className={`mt-5 grid w-full gap-1.5 ${compact ? 'justify-items-center' : ''}`}>
        <SidebarItem
          icon={<MessageSquarePlus size={18} />}
          label="Pesanan baru"
          active={!activeId}
          compact={compact}
          onClick={onNewOrder}
        />
        <SidebarItem
          icon={<PackageSearch size={18} />}
          label="Lacak pesanan"
          href="/pesan/lacak"
          compact={compact}
        />
        <SidebarItem
          icon={<ShoppingBag size={18} />}
          label="Keranjang"
          href="#chat-cart"
          badge={cartCount}
          compact={compact}
        />
        <SidebarItem
          icon={<LifeBuoy size={18} />}
          label="Bantuan"
          href="#bantuan"
          compact={compact}
        />
      </div>

      {!compact && (
        <div className="mt-6 rounded-[1.8rem] border border-[#efe4d3] bg-[#fffaf3]/90 p-4 shadow-[0_18px_44px_rgba(47,36,28,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#a08973]">Riwayat chat</p>
          <p className="mt-2 text-sm leading-6 text-[#776454]">
            Buka percakapan terakhir tanpa mulai dari nol. Riwayat aktif otomatis ikut diperbarui.
          </p>
        </div>
      )}

      <div
        className={`mt-5 min-h-0 flex-1 overflow-y-auto scrollbar-thin scrollbar-gutter-stable ${
          compact ? 'w-full overflow-hidden' : 'pr-1'
        }`}
      >
        {compact ? (
          <div className="flex flex-col items-center gap-3 pb-3 pt-1">
            {sessions.slice(0, 7).map((session) => (
              <div key={session.id} title={session.title || 'Pesanan Baru'}>
                <button
                  type="button"
                  onClick={() => onSelectSession?.(session.id)}
                  disabled={loadingSessionId === session.id}
                  className={`grid h-11 w-11 place-items-center rounded-2xl border text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4423]/15 ${
                    activeId === session.id
                      ? 'border-[#ddceb8] bg-[#fffaf2] text-[#6b4423] shadow-[0_14px_30px_rgba(107,68,35,0.12)]'
                      : 'border-transparent bg-transparent text-[#816f60] hover:border-[#e6d8c4] hover:bg-[#fbf4e8]'
                  } ${loadingSessionId === session.id ? 'cursor-wait opacity-70' : ''}`}
                >
                  {(session.title || 'P').slice(0, 1).toUpperCase()}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div ref={historyRef} className="space-y-2 pb-4">
            {sessions.length === 0 ? (
              <p className="rounded-[1.5rem] border border-dashed border-[#ddceb8] bg-[#fffaf3] p-4 text-sm leading-6 text-[#776454]">
                Belum ada riwayat lain. Percakapan baru akan muncul otomatis di sini.
              </p>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onSelectSession?.(session.id)}
                  disabled={loadingSessionId === session.id}
                  className={`w-full rounded-[1.6rem] px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4423]/15 ${
                    activeId === session.id
                      ? 'bg-[#fffaf2] shadow-[0_16px_34px_rgba(107,68,35,0.10)]'
                      : 'hover:bg-[#fbf4e8]'
                  } ${loadingSessionId === session.id ? 'cursor-wait opacity-70' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold tracking-[-0.02em] text-[#2f241c]">
                        {session.title || 'Pesanan Baru'}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[#927d6a]">
                        <span className="rounded-full bg-[#f4ead9] px-2 py-0.5 font-medium text-[#6b4423]">
                          {statusLabel(session.status)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock3 size={12} />
                          {formatSessionTime(session.updatedAt)}
                        </span>
                      </div>
                    </div>
                    {activeId === session.id && (
                      <span className="rounded-full bg-[#6b4423] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                        Live
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
