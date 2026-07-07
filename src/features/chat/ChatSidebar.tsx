'use client';

import { useState } from 'react';
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useHover,
  useInteractions,
  useRole,
} from '@floating-ui/react';
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

function RailTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'right',
    whileElementsMounted: autoUpdate,
    middleware: [offset(10), flip(), shift({ padding: 8 })],
  });
  const hover = useHover(context, { move: false });
  const dismiss = useDismiss(context);
  const role = useRole(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, dismiss, role]);

  return (
    <>
      <div ref={(node) => refs.setReference(node)} {...getReferenceProps()}>
        {children}
      </div>
      {open && (
        <div
          ref={(node) => refs.setFloating(node)}
          style={floatingStyles}
          {...getFloatingProps()}
          className="z-[70] rounded-full border border-[#f0dfca] bg-[#fffaf3] px-3 py-1.5 text-xs font-medium text-[#5f4d3f] shadow-[0_14px_34px_rgba(47,36,28,0.12)]"
        >
          {label}
        </div>
      )}
    </>
  );
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
  const className = `group flex w-full items-center gap-3 rounded-[1rem] px-2 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c55a2b]/15 ${
    active
      ? 'bg-[#fff9f2] text-[#2f241c]'
      : 'text-[#715f50] hover:bg-[#f9efe0] hover:text-[#2f241c]'
  } ${compact ? 'justify-center' : ''}`;

  const content = (
    <>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${active ? 'bg-[#fde8d9] text-[#c55a2b]' : 'bg-transparent text-current group-hover:bg-[#f3e7d8]'}`}>
        {icon}
      </span>
      {!compact && (
        <>
          <span className="flex-1 truncate">{label}</span>
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
  return <RailTooltip label={label}>{element}</RailTooltip>;
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
  onQuickAction,
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
  onQuickAction?: (action: string, payload?: Record<string, unknown>) => void;
  loadingSessionId?: string | null;
}) {
  return (
    <aside
      className={`flex h-full flex-col border-r border-[#f0dfca] bg-[linear-gradient(180deg,rgba(255,252,247,0.96)_0%,rgba(248,240,229,0.9)_100%)] px-2 py-3 text-[#2f241c] ${
        compact ? 'items-center' : ''
      }`}
    >
      <div className={`flex ${compact ? 'w-full flex-col items-center gap-2' : 'items-center justify-between gap-2 px-1'}`}>
        {compact ? (
          <>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#c55a2b] text-white shadow-[0_12px_28px_rgba(197,90,43,0.2)]">
              <Sparkles size={16} />
            </div>
            {!mobile && (
              <button
                type="button"
                onClick={onToggleCompact}
                className="grid h-8 w-8 place-items-center rounded-xl text-[#786455] transition hover:bg-[#f3ebdc] hover:text-[#2f241c]"
                aria-label="Buka sidebar"
              >
                <ChevronRight size={16} />
              </button>
            )}
          </>
        ) : (
          <>
            <div>
              <p className="text-base font-semibold tracking-[-0.03em] text-[#2f241c]">Rumah Keripik AI</p>
              <p className="text-xs text-[#7c6858]">Pesan, lacak, dan cek keranjang</p>
            </div>
            {!mobile && (
              <button
                type="button"
                onClick={onToggleCompact}
                className="grid h-8 w-8 place-items-center rounded-xl text-[#786455] transition hover:bg-[#f3ebdc] hover:text-[#2f241c]"
                aria-label="Ciutkan sidebar"
              >
                <ChevronLeft size={16} />
              </button>
            )}
          </>
        )}
      </div>

      <div className={`mt-5 grid w-full gap-2 ${compact ? 'justify-items-center' : ''}`}>
        <SidebarItem icon={<MessageSquarePlus size={16} />} label="Pesanan baru" active={!activeId} compact={compact} onClick={onNewOrder} />
        <SidebarItem icon={<PackageSearch size={16} />} label="Lacak pesanan" href="/pesan/lacak" compact={compact} />
        <SidebarItem
          icon={<ShoppingBag size={16} />}
          label="Keranjang"
          badge={cartCount}
          compact={compact}
          onClick={() => onQuickAction?.('show_cart')}
        />
        <SidebarItem
          icon={<LifeBuoy size={16} />}
          label="Bantuan"
          compact={compact}
          onClick={() => onQuickAction?.('help_overview')}
        />
      </div>

      {!compact && (
        <div className="mt-6 min-h-0 flex-1 overflow-hidden">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a08973]">Riwayat chat</p>
            <span className="text-[11px] text-[#9b8772]">{sessions.length}</span>
          </div>
          <div className="h-full overflow-y-auto pr-1 scrollbar-thin [scrollbar-color:#ccaf8f_transparent]">
            <div className="space-y-2 pb-4">
              {sessions.length === 0 ? (
                <p className="rounded-[1.15rem] border border-dashed border-[#e3cfb6] bg-[#fffaf3] p-3 text-sm text-[#776454]">
                  Belum ada riwayat lain.
                </p>
              ) : (
                sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => onSelectSession?.(session.id)}
                    disabled={loadingSessionId === session.id}
                    className={`w-full rounded-[1.15rem] px-3 py-2.5 text-left transition ${
                      activeId === session.id ? 'bg-[#fff9f2]' : 'hover:bg-[#fbf1e4]'
                    } ${loadingSessionId === session.id ? 'cursor-wait opacity-70' : ''}`}
                  >
                    <p className="truncate text-sm font-semibold text-[#2f241c]">
                      {session.title || 'Pesanan Baru'}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[#927d6a]">
                      <span className="rounded-full bg-[#fde8d9] px-2 py-0.5 font-medium text-[#c55a2b]">
                        {statusLabel(session.status)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={11} />
                        {formatSessionTime(session.updatedAt)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {compact && <div className="mt-auto h-2 w-full" />}
    </aside>
  );
}
