'use client';

import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Package,
  Users,
  MessageSquare,
  LogOut,
  Home,
  Bot,
  Bell,
  Menu,
  X,
  ShoppingCart,
  ShieldAlert,
  Plus,
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
  { href: '/transaksi', label: 'Transaksi, Pembayaran & Kirim', icon: ShoppingCart, activeHrefs: ['/transaksi', '/pembayaran/verifikasi'] },
  { href: '/livechat', label: 'Live Chat & Chat Hub', icon: MessageSquare, activeHrefs: ['/livechat', '/hub-komunikasi'] },
  { href: '/ai-workspace', label: 'Knowledge Base & AI', icon: Bot, activeHrefs: ['/ai-workspace', '/bot-config', '/knowledge-base', '/ai-monitor', '/ai-skills', '/model-router'] },
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
      } catch { /* ignore */ }
    }

    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [addToast]);

  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
      } catch { /* ignore */ }
    }
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  const totalNotif = notifs.pending_verifikasi + notifs.unread_chats;

  const currentLabel = menuItems.find((item) => isMenuActive(pathname, item))?.label || 'Dashboard';

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="border-b border-outline-variant/70 p-4">
        <div className="rounded-[1.4rem] border border-outline-variant/70 bg-surface-container-lowest px-3 py-3 shadow-[0_12px_28px_rgba(47,36,28,0.05)]">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-sm font-semibold text-on-primary shadow-[0_10px_24px_rgba(107,68,35,0.16)]">RK</div>
            <div>
              <h1 className="text-sm font-semibold tracking-[0.12em] text-on-surface">RUMAH KERIPIK</h1>
              <p className="text-xs text-on-surface-variant">Admin workspace</p>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-1 px-3 pb-4 overflow-y-auto scrollbar-thin">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = isMenuActive(pathname, item);
          return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => { setSidebarOpen(false); if (navigator.vibrate) navigator.vibrate(10); }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-surface-container-lowest text-on-surface border border-outline-variant shadow-[inset_3px_0_0_#d6a24a,0_10px_24px_rgba(47,36,28,0.05)]'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <Icon size={18} />
              <span className="text-sm font-medium flex-1">{item.label}</span>
              {item.href === '/transaksi' && notifs.pending_verifikasi > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-error text-on-error text-[10px] font-medium">
                  {notifs.pending_verifikasi}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-outline-variant">
        <button
          onClick={() => setLogoutOpen(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-on-surface-variant hover:bg-surface-container hover:text-on-surface rounded-xl transition-colors"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </div>
  );

  async function handleLogout() {
    setLogoutLoading(true);
    await signOut({ callbackUrl: '/login' });
  }

  return (
    <ToastProvider>
    <NotificationPoller />
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-sidebar-width flex-col bg-[linear-gradient(180deg,rgba(255,249,241,0.95)_0%,rgba(246,239,228,0.92)_100%)] border-r border-outline-variant">
        {sidebarContent}
      </aside>

      {/* Sidebar - Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside
            className="relative h-full w-72 border-r border-outline-variant bg-[linear-gradient(180deg,rgba(255,249,241,0.98)_0%,rgba(246,239,228,0.96)_100%)] shadow-[0_18px_50px_rgba(47,36,28,0.12)] animate-in slide-in-from-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end p-4">
              <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-surface-container rounded-xl text-on-surface-variant">
                <X size={20} />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-surface-container-lowest/92 backdrop-blur px-container-padding h-16 flex items-center justify-between shrink-0 sticky top-0 z-30 border-b border-outline-variant shadow-[0_8px_20px_rgba(47,36,28,0.04)]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-surface-container rounded-xl text-on-surface-variant"
            >
              <Menu size={20} />
            </button>
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-on-surface leading-tight">{currentLabel}</h2>
              <p className="font-caption text-caption text-on-surface-variant hidden md:block">{dateStr}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)} className="relative p-2 hover:bg-surface-container rounded-full text-on-surface-variant hover:text-on-surface transition-colors">
                <Bell size={20} />
                {totalNotif > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 px-1.5 py-0.5 rounded-full bg-error text-on-error text-[10px] font-medium leading-none">
                    {totalNotif > 99 ? '99+' : totalNotif}
                  </span>
                )}
              </button>
              {notifOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-[0_16px_44px_rgba(15,23,42,0.10)] z-50 overflow-hidden">
                  <div className="p-3 border-b border-outline-variant">
                    <p className="text-sm font-semibold text-on-surface">Notifikasi</p>
                  </div>
                  <div className="p-2 space-y-1">
                    {notifs.pending_verifikasi > 0 ? (
                      <Link href="/transaksi?tab=verifikasi" onClick={() => setNotifOpen(false)}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-container transition-colors">
                        <ShieldAlert size={18} className="text-warning shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{notifs.pending_verifikasi} pembayaran perlu diverifikasi</p>
                          <p className="text-xs text-on-surface-variant">Klik untuk memverifikasi</p>
                        </div>
                      </Link>
                    ) : (
                      <div className="p-3 text-sm text-on-surface-variant text-center">Tidak ada notifikasi baru</div>
                    )}
                    {notifs.unread_chats > 0 && (
                      <Link href="/livechat" onClick={() => setNotifOpen(false)}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-container transition-colors">
                        <MessageSquare size={18} className="text-primary shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{notifs.unread_chats} pesan belum dibaca</p>
                          <p className="text-xs text-on-surface-variant">Klik untuk buka Live Chat</p>
                        </div>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-on-primary font-semibold text-sm overflow-hidden shadow-[0_10px_24px_rgba(107,68,35,0.18)]">
              <span>AP</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-container-padding pb-20 lg:pb-container-padding">
          {children}
        </main>

        {/* Bottom Nav - Mobile */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest/95 backdrop-blur border-t border-outline-variant flex justify-around items-center h-16 px-2 pb-safe">
          {[
            { href: '/dashboard', label: 'Home', icon: Home },
            { href: '/master-data/pelanggan', label: 'Mitra', icon: Users },
            { href: '/transaksi', label: 'Transaksi', icon: ShoppingCart },
            { href: '/livechat', label: 'Chat', icon: MessageSquare },
            { href: '/ai-workspace', label: 'AI', icon: Bot },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = isMenuActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 px-4 py-1.5 rounded-full transition-colors ${
                  isActive ? 'bg-surface-container text-on-surface' : 'text-on-surface-variant'
                }`}
              >
                <Icon size={20} />
                <span className="font-caption text-caption">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* FAB — Tambah Transaksi (Mobile) */}
        <Link
          href="/transaksi?action=baru"
          className="lg:hidden fixed bottom-20 right-4 z-50 w-12 h-12 rounded-full bg-primary text-on-primary shadow-[0_10px_30px_rgba(15,23,42,0.16)] flex items-center justify-center hover:bg-primary/90 transition-colors active:scale-95"
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
