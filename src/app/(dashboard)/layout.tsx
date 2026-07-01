'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  Package,
  Users,
  Store,
  MessageSquare,
  BookOpen,
  LogOut,
  Home,
  Bot,
  Bell,
  Menu,
  X,
  ShoppingCart,
  MapPin,
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
  { href: '/', label: 'Beranda & Analitik', icon: Home },
  { href: '/master-data/produk', label: 'Produk', icon: Package },
  { href: '/master-data/pelanggan', label: 'Pelanggan & Mitra', icon: Users },
  { href: '/transaksi', label: 'Transaksi & Pengiriman', icon: ShoppingCart },
  { href: '/livechat', label: 'Hub Komunikasi', icon: MessageSquare },
  { href: '/bot-config', label: 'Knowledge Base & AI', icon: Bot },
];

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
          addToast('success', `🔔 ${data.pending_verifikasi - prev.pending_verifikasi} pembayaran baru perlu diverifikasi`);
        }
        if (prev.unread_chats > 0 && data.unread_chats > prev.unread_chats) {
          addToast('info', `💬 ${data.unread_chats - prev.unread_chats} chat baru masuk`);
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
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    setDateStr(
      new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    );
  }, []);

  const prevCountsRef = useRef({ pending_verifikasi: 0, unread_chats: 0 });

  useEffect(() => {
    async function fetchNotifs() {
      try {
        const res = await fetch('/api/admin/notification-counts');
        if (!res.ok) return;
        const data: NotifCounts = await res.json();
        prevCountsRef.current = data;
        setNotifs(data);
      } catch { /* ignore */ }
    }
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  const totalNotif = notifs.pending_verifikasi + notifs.unread_chats;

  const currentLabel = menuItems.find(
    (item) => item.href === pathname || pathname.startsWith(item.href + '/')
  )?.label || 'Dashboard';

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-6">
        <h1 className="font-headline-sm text-headline-sm font-bold text-primary">Rumah Kripik Admin</h1>
      </div>

      <nav className="flex-1 flex flex-col gap-1 px-2 pb-4 overflow-y-auto scrollbar-thin">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => { setSidebarOpen(false); if (navigator.vibrate) navigator.vibrate(10); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <Icon size={20} />
              <span className="font-label-md text-label-md flex-1">{item.label}</span>
              {item.href === '/transaksi' && notifs.pending_verifikasi > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-error text-on-error text-[10px] font-bold">
                  {notifs.pending_verifikasi}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-outline-variant/30">
        <button
          onClick={() => setLogoutOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-colors"
        >
          <LogOut size={20} />
          <span className="font-label-md text-label-md">Logout</span>
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
    <div className="flex h-screen overflow-hidden bg-surface-cream">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-sidebar-width flex-col bg-surface-container-low border-r border-outline-variant/30">
        {sidebarContent}
      </aside>

      {/* Sidebar - Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside
            className="relative w-72 h-full bg-surface-container-low border-r border-outline-variant/30 shadow-xl animate-in slide-in-from-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end p-4">
              <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-surface-container-high rounded-lg text-on-surface-variant">
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
        <header className="bg-surface px-container-padding h-16 flex items-center justify-between shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1 hover:bg-surface-container rounded-lg text-on-surface-variant"
            >
              <Menu size={20} />
            </button>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface leading-tight">{currentLabel}</h2>
              <p className="font-caption text-caption text-on-surface-variant hidden md:block">{dateStr}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)} className="relative p-2 hover:bg-surface-container rounded-full text-primary transition-colors">
                <Bell size={20} />
                {totalNotif > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 px-1.5 py-0.5 rounded-full bg-error text-on-error text-[10px] font-bold leading-none">
                    {totalNotif > 99 ? '99+' : totalNotif}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-surface-container-lowest border border-neutral-200 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-outline-variant/20">
                    <p className="font-label-md text-label-md text-on-surface">Notifikasi</p>
                  </div>
                  <div className="p-2 space-y-1">
                    {notifs.pending_verifikasi > 0 ? (
                      <Link href="/transaksi" onClick={() => setNotifOpen(false)}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-container transition-colors">
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
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-container transition-colors">
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
            <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-sm border-2 border-surface-container-highest overflow-hidden">
              <span>AP</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-container-padding pb-20 lg:pb-container-padding">
          {children}
        </main>

        {/* Bottom Nav - Mobile */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-outline-variant/20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-around items-center h-16 px-2 pb-safe">
          {[
            { href: '/', label: 'Home', icon: Home },
            { href: '/master-data/pelanggan', label: 'Mitra', icon: Users },
            { href: '/transaksi', label: 'Transaksi', icon: ShoppingCart },
            { href: '/livechat', label: 'Chat Hub', icon: MessageSquare },
            { href: '/bot-config', label: 'KB & AI', icon: Bot },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 px-4 py-1 rounded-full transition-colors ${
                  isActive ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant'
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
          className="lg:hidden fixed bottom-20 right-4 z-50 w-12 h-12 rounded-full bg-primary text-on-primary shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors active:scale-95"
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
