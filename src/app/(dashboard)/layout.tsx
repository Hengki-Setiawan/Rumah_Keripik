'use client';

import { useState, useEffect } from 'react';
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
  ChevronDown,
  AlertTriangle,
  Send,
} from 'lucide-react';
import { ToastProvider } from '@/components/ui/toast';
import { ConfirmModal } from '@/components/ui/modal';

const menuItems = [
  { href: '/', label: 'Beranda', icon: Home },
  { href: '/analitik', label: 'Analitik', icon: BarChart3 },
  { href: '/master-data/produk', label: 'Produk', icon: Package },
  { href: '/master-data/pelanggan', label: 'Pelanggan', icon: Users },
  { href: '/master-data/warung', label: 'Warung Retail', icon: Store },
  { href: '/master-data/transaksi-offline', label: 'Transaksi Offline', icon: BarChart3 },
  { href: '/livechat', label: 'Live Chat', icon: MessageSquare },
  { href: '/broadcast', label: 'Broadcast', icon: Send },
  { href: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
  { href: '/bot-config', label: 'Bot Config', icon: Bot },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
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
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <Icon size={20} />
              <span className="font-label-md text-label-md">{item.label}</span>
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
    <div className="flex h-screen overflow-hidden bg-surface-cream">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-sidebar-width flex-col bg-surface-container-low border-r border-outline-variant/30">
        {sidebarContent}
      </aside>

      {/* Sidebar - Mobile Drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <aside
            className="relative w-72 h-full bg-surface-container-low border-r border-outline-variant/30 shadow-xl animate-in slide-in-from-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end p-4">
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 hover:bg-surface-container-high rounded-lg text-on-surface-variant"
              >
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
              <h2 className="font-headline-sm text-headline-sm text-on-surface leading-tight">
                {currentLabel}
              </h2>
              <p className="font-caption text-caption text-on-surface-variant hidden md:block">
                {dateStr}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {pathname === '/knowledge-base' && (
              <div className="hidden md:flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant">
                <Bot size={16} className="text-bot-indigo" />
                <span className="font-label-md text-label-md text-on-surface">Bot Engine 2.4</span>
              </div>
            )}
            <button className="relative p-2 hover:bg-surface-container rounded-full text-primary transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full" />
            </button>
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
            { href: '/master-data/produk', label: 'Master', icon: Package },
            { href: '/livechat', label: 'Chat', icon: MessageSquare },
            { href: '/knowledge-base', label: 'AI', icon: BookOpen },
            { href: '/bot-config', label: 'Rules', icon: Bot },
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
