'use client';

import Link from 'next/link';
import { BarChart3, Package, MessageSquare, BookOpen, TrendingUp, Bot, Store, Users } from 'lucide-react';

const modules = [
  {
    href: '/analitik',
    title: 'Analitik & Keuangan',
    description: 'Dashboard KPI, grafik omzet, ranking produk, dan laporan keuangan',
    icon: BarChart3,
  },
  {
    href: '/master-data/produk',
    title: 'Manajemen Produk',
    description: 'CRUD produk, manajemen stok, dan pengaturan harga',
    icon: Package,
  },
  {
    href: '/master-data/pelanggan',
    title: 'Data Pelanggan',
    description: 'Kelola data pelanggan chatbot dan riwayat transaksi',
    icon: Users,
  },
  {
    href: '/master-data/warung',
    title: 'Warung Retail',
    description: 'Kelola data warung grosir dan agent penjualan',
    icon: Store,
  },
  {
    href: '/master-data/transaksi-offline',
    title: 'Transaksi Offline',
    description: 'Catat penjualan offline dan kelola piutang',
    icon: TrendingUp,
  },
  {
    href: '/livechat',
    title: 'Live Chat Panel',
    description: 'Pantau percakapan chatbot, ambil alih manual, dan balas pesan',
    icon: MessageSquare,
  },
  {
    href: '/knowledge-base',
    title: 'Knowledge Base',
    description: 'Kelola dokumen KB, upload files, dan embed ke vector database',
    icon: BookOpen,
  },
  {
    href: '/bot-config',
    title: 'Bot Config',
    description: 'Atur auto reply rules, pantau token AI, dan log percakapan',
    icon: Bot,
  },
];

const moduleColors = [
  'bg-primary-fixed text-primary',
  'bg-secondary-fixed text-secondary',
  'bg-tertiary-fixed text-tertiary',
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-pink-100 text-pink-700',
  'bg-indigo-100 text-indigo-700',
  'bg-gray-200 text-gray-700',
];

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-8">
        <h2 className="font-headline-lg text-headline-lg text-on-surface">Selamat Datang!</h2>
        <p className="text-on-surface-variant mt-1">
          Kelola semua aspek bisnis Rumah Kripik dari satu dashboard terpusat.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
        {modules.map((module, i) => {
          const Icon = module.icon;
          return (
            <Link
              key={module.href}
              href={module.href}
              className="group bg-surface-container-lowest rounded-xl border border-neutral-200 hover:shadow-lg transition-all duration-300 p-6 hover:border-primary-fixed-dim"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${moduleColors[i % moduleColors.length]}`}>
                  <Icon size={24} />
                </div>
                <span className="font-caption text-caption text-outline group-hover:text-primary transition-colors">
                  Buka
                </span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">{module.title}</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">{module.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
