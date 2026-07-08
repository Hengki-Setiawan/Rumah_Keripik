'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import {
  Bell,
  Bot,
  ChevronLeft,
  ChevronRight,
  Home,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Plus,
  ShieldAlert,
  ShoppingCart,
  Users,
  X,
} from 'lucide-react';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { ConfirmModal } from '@/components/ui/modal';

interface NotifCounts {
  pending_verifikasi: number;
  unread_chats: number;
}

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/master-data/produk', label: 'Produk', icon: Package },
  { href: '/master-data/pelanggan', label: 'Pelanggan & Mitra', icon: Users },
  { href: '/transaksi', label: 'Transaksi', icon: ShoppingCart, activeHrefs: ['/transaksi', '/pembayaran/verifikasi'] },
  { href: '/hub-komunikasi', label: 'Komunikasi', icon: MessageSquare, activeHrefs: ['/hub-komunikasi', '/livechat'] },
  { href: '/ai-workspace', label: 'AI Workspace', icon: Bot, activeHrefs: ['/ai-workspace', '/bot-config', '/knowledge-base', '/ai-monitor', '/ai-skills', '/model-router'] },
  { href: '/feedback-learning', label: 'Feedback', icon: Bot },
];

function isMenuActive(pathname: string, item: { href: string; activeHrefs?: string[] }) {
  const paths = item.activeHrefs || [item.href];
  return paths.some((href) => pathname === href || pathname.startsWith(href + '/'));
}

function NotificationPoller() {
  const { addToast } = useToast();

  useEffect(() => {
    let prev = { pending_verifikasi: 0, unread_chats: 0 };

    async function poll() {
      try {
        const res = await fetch('/api/admin/notification-counts');
        if (!res.ok) return;
        const data: NotifCounts = await res.json();

        if (prev.pending_verifikasi > 0 && data.pending_verifikasi > prev.pending_verifikasi) {
          addToast('success', `${data.pending_verifikasi - prev.pending_verifikasi} pembayaran baru perlu diverifikasi`);
        }
        if (prev.unread_chats > 0 && data.unread_chats > prev.unread_chats) {
          addToast('info', `${data.unread_chats - prev.unread_chats} chat baru masuk`);
        }
        prev = data;
      } catch {
        // ignore
      }
    }

    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [addToast]);

  return null;
}

function SidebarLink({
  item,
  pathname,
  compact,
  badge,
  onNavigate,
}: {
  item: (typeof menuItems)[number];
  pathname: string;
  compact?: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const isActive = isMenuActive(pathname, item);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`group flex items-center gap-3 rounded-[1rem] px-2 py-2 transition-all ${
        isActive
          ? 'bg-[#fff9f2] text-[#2f241c] shadow-[0_10px_22px_rgba(47,36,28,0.05)]'
          : 'text-[#756252] hover:bg-[#f9efe0] hover:text-[#2f241c]'
      } ${compact ? 'justify-center px-2' : ''}`}
      title={compact ? item.label : undefined}
    >
      <span className={`grid h-8 w-8 place-items-center rounded-xl ${isActive ? 'bg-[#fde8d9] text-[#c55a2b]' : 'group-hover:bg-[#f3e7d8]'}`}>
        <Icon size={16} />
      </span>
      {!compact && (
        <>
          <span className="flex-1 text-sm font-medium">{item.label}</span>
          {badge ? (
            <span className="rounded-full bg-[#c55a2b] px-2 py-0.5 text-[11px] font-semibold text-white">
              {badge}
            </span>
          ) : null}
        </>
      )}
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotifCounts>({ pending_verifikasi: 0, unread_chats: 0 });
  const pathname = usePathname();

  const dateStr = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Makassar',
  }).format(new Date());

  useEffect(() => {
    async function fetchNotifs() {
      try {
        const res = await fetch('/api/admin/notification-counts');
        if (!res.ok) return;
        const data: NotifCounts = await res.json();
        setNotifs(data);
      } catch {
        // ignore
      }
    }

    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  const totalNotif = notifs.pending_verifikasi + notifs.unread_chats;
  const currentLabel = menuItems.find((item) => isMenuActive(pathname, item))?.label || 'Dashboard';

  async function handleLogout() {
    setLogoutLoading(true);
    await signOut({ callbackUrl: '/login' });
  }

  const sidebarContent = (compact = false) => (
    <div className={`flex h-full flex-col ${compact ? 'items-center' : ''}`}>
      <div className={`flex ${compact ? 'w-full flex-col items-center gap-2 px-1' : 'items-center justify-between px-1'} pb-4`}>
        {compact ? (
          <>
            <BrandLogo variant="mark" className="h-10 w-10 rounded-xl object-contain shadow-[0_14px_32px_rgba(197,90,43,0.18)]" priority />
            <button
              type="button"
              onClick={() => setSidebarCollapsed((value) => !value)}
              className="hidden lg:grid h-8 w-8 place-items-center rounded-xl text-[#786455] transition hover:bg-[#f3ebdc] hover:text-[#2f241c]"
              aria-label="Buka sidebar"
            >
              <ChevronRight size={16} />
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div>
                <BrandLogo variant="full" className="h-auto w-[162px]" priority />
                <p className="mt-1 text-xs text-[#7a6758]">Dashboard operasional dan kontrol pesanan</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSidebarCollapsed((value) => !value)}
              className="hidden lg:grid h-8 w-8 place-items-center rounded-xl text-[#786455] transition hover:bg-[#f3ebdc] hover:text-[#2f241c]"
              aria-label="Ciutkan sidebar"
            >
              <ChevronLeft size={16} />
            </button>
          </>
        )}
      </div>

      {!compact && (
        <div className="mb-4 rounded-[1.25rem] border border-[#f0dfca] bg-[#fffaf3]/92 p-3.5 shadow-[0_10px_24px_rgba(47,36,28,0.04)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#a08973]">Workspace</p>
          <p className="mt-2 text-sm leading-6 text-[#776454]">
            Penjualan, live chat, dan modul AI dalam satu shell yang lebih ringan.
          </p>
        </div>
      )}

      <nav className={`flex-1 space-y-1 overflow-y-auto scrollbar-thin ${compact ? 'w-full px-0' : 'pr-1'}`}>
        {menuItems.map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            pathname={pathname}
            compact={compact}
            badge={item.href === '/transaksi' ? notifs.pending_verifikasi : undefined}
            onNavigate={() => setSidebarOpen(false)}
          />
        ))}
      </nav>

        <div className={`pt-4 ${compact ? 'w-full' : ''}`}>
          <button
            onClick={() => setLogoutOpen(true)}
            className={`flex items-center gap-3 rounded-[1rem] px-2 py-2 text-[#756252] transition hover:bg-[#f9efe0] hover:text-[#2f241c] ${compact ? 'w-full justify-center px-2' : 'w-full'}`}
            title={compact ? 'Logout' : undefined}
          >
            <span className="grid h-8 w-8 place-items-center rounded-xl">
              <LogOut size={16} />
            </span>
            {!compact && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
    </div>
  );

  return (
    <ToastProvider>
      <NotificationPoller />
      <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(240,180,41,0.12),transparent_20%),linear-gradient(180deg,#faf6ef_0%,#fffaf4_100%)]">
        <aside
          className={`hidden lg:block shrink-0 border-r border-[#f0dfca] bg-[linear-gradient(180deg,rgba(255,252,247,0.96)_0%,rgba(248,240,229,0.92)_100%)] px-2 py-3 backdrop-blur-xl transition-[width] duration-300 ${
            sidebarCollapsed ? 'w-[64px]' : 'w-[236px]'
          }`}
        >
          {sidebarContent(sidebarCollapsed)}
        </aside>

        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
            <aside
              className="relative h-full w-[236px] max-w-[82vw] border-r border-[#f0dfca] bg-[linear-gradient(180deg,rgba(255,252,247,0.98)_0%,rgba(248,240,229,0.96)_100%)] px-2 py-3 shadow-[0_24px_70px_rgba(47,36,28,0.16)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-full text-[#756252] transition hover:bg-[#f3ebdc] hover:text-[#2f241c]"
                >
                  <X size={18} />
                </button>
              </div>
              {sidebarContent(false)}
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-wrap items-start justify-between gap-3 px-4 pb-2 pt-4 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="grid h-10 w-10 place-items-center rounded-full border border-[#f0dfca] bg-[#fffaf3]/92 text-[#6f5d4f] shadow-[0_8px_22px_rgba(47,36,28,0.06)] lg:hidden"
              >
                <Menu size={18} />
              </button>
              <div className="min-w-0">
                <p className="line-clamp-1 text-xs font-medium uppercase tracking-[0.18em] text-[#9a8672] md:tracking-[0.22em]">{dateStr}</p>
                <h2 className="mt-1 truncate text-lg font-semibold tracking-[-0.03em] text-[#2f241c]">{currentLabel}</h2>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen((value) => !value)}
                  className="relative grid h-10 w-10 place-items-center rounded-full border border-[#f0dfca] bg-[#fffaf3]/92 text-[#6f5d4f] shadow-[0_8px_22px_rgba(47,36,28,0.06)] transition hover:text-[#2f241c]"
                >
                  <Bell size={17} />
                  {totalNotif > 0 && (
                    <span className="absolute right-0 top-0 rounded-full bg-[#c55a2b] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                      {totalNotif > 99 ? '99+' : totalNotif}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 top-full z-50 mt-3 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-[1.4rem] border border-[#f0dfca] bg-[#fffaf3] shadow-[0_24px_70px_rgba(47,36,28,0.12)]">
                    <div className="border-b border-[#f0e4d2] px-4 py-3">
                      <p className="text-sm font-semibold text-[#2f241c]">Notifikasi</p>
                    </div>
                    <div className="p-2">
                      {notifs.pending_verifikasi > 0 ? (
                        <Link
                          href="/transaksi?tab=verifikasi"
                          onClick={() => setNotifOpen(false)}
                          className="flex items-center gap-3 rounded-[1.1rem] p-3 transition hover:bg-[#f9efe0]"
                        >
                          <ShieldAlert size={18} className="shrink-0 text-[#c55a2b]" />
                          <div>
                            <p className="text-sm font-medium text-[#2f241c]">
                              {notifs.pending_verifikasi} pembayaran perlu diverifikasi
                            </p>
                            <p className="text-xs text-[#776454]">Klik untuk memverifikasi</p>
                          </div>
                        </Link>
                      ) : (
                        <div className="p-3 text-sm text-[#776454]">Tidak ada notifikasi baru</div>
                      )}

                      {notifs.unread_chats > 0 && (
                        <Link
                          href="/hub-komunikasi"
                          onClick={() => setNotifOpen(false)}
                          className="flex items-center gap-3 rounded-[1.1rem] p-3 transition hover:bg-[#f9efe0]"
                        >
                          <MessageSquare size={18} className="shrink-0 text-[#7f9f3e]" />
                          <div>
                            <p className="text-sm font-medium text-[#2f241c]">
                              {notifs.unread_chats} pesan belum dibaca
                            </p>
                            <p className="text-xs text-[#776454]">Klik untuk buka Hub Komunikasi</p>
                          </div>
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <BrandLogo variant="mark" className="h-10 w-10 rounded-full object-contain shadow-[0_14px_34px_rgba(197,90,43,0.14)]" />
            </div>
          </header>

          <main className="flex-1 overflow-auto px-4 pb-24 pt-3 md:px-6 md:pb-8">
            {children}
          </main>

          <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-[#f0dfca] bg-[rgba(255,250,243,0.94)] px-1 backdrop-blur-xl lg:hidden">
            {[
              { href: '/dashboard', label: 'Home', icon: Home },
              { href: '/master-data/pelanggan', label: 'Mitra', icon: Users },
              { href: '/transaksi', label: 'Transaksi', icon: ShoppingCart },
              { href: '/hub-komunikasi', label: 'Chat', icon: MessageSquare, activeHrefs: ['/hub-komunikasi', '/livechat'] },
              { href: '/ai-workspace', label: 'AI', icon: Bot },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = isMenuActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1.5 transition ${
                    isActive ? 'bg-[#fde8d9] text-[#2f241c]' : 'text-[#7a6758]'
                  }`}
                >
                  <Icon size={18} />
                  <span className="truncate text-[10px] font-medium sm:text-[11px]">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <Link
            href="/transaksi?action=baru"
            className="fixed bottom-20 right-4 z-50 grid h-12 w-12 place-items-center rounded-full bg-[#c55a2b] text-white shadow-[0_18px_44px_rgba(197,90,43,0.18)] transition hover:bg-[#ae4d23] lg:hidden"
          >
            <Plus size={22} />
          </Link>
        </div>
      </div>

      <ConfirmModal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={handleLogout}
        title="Keluar Dashboard"
        message="Apakah Anda yakin ingin keluar dari dashboard?"
        confirmLabel="Keluar"
        variant="danger"
        loading={logoutLoading}
      />
    </ToastProvider>
  );
}
