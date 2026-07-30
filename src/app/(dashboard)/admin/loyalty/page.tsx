'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Gift, TrendingUp, Award, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface LoyaltyStats {
  totalAccounts: number;
  tierDistribution: { bronze: number; silver: number; gold: number };
  totalPointsIssued: number;
  totalPointsRedeemed: number;
}

export default function AdminLoyaltyPage() {
  const [stats, setStats] = useState<LoyaltyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/loyalty/stats')
      .then(r => r.json())
      .then(j => { if (j.ok) setStats(j.stats); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Program Loyalitas</h1>
          <p className="text-sm text-muted-foreground mt-1">Poin, tier, dan aktivitas referral pelanggan</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/transaksi" className="text-amber-600 hover:underline font-medium">Lihat transaksi →</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-2.5"><Users size={20} className="text-amber-700" /></div>
            <div>
              <p className="text-2xl font-bold">{loading ? '...' : stats?.totalAccounts ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total Akun Loyalty</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-emerald-100 p-2.5"><Gift size={20} className="text-emerald-700" /></div>
            <div>
              <p className="text-2xl font-bold">{loading ? '...' : (stats?.totalPointsIssued ?? 0).toLocaleString('id-ID')}</p>
              <p className="text-xs text-muted-foreground">Poin Diterbitkan</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-red-100 p-2.5"><ArrowDownRight size={20} className="text-red-700" /></div>
            <div>
              <p className="text-2xl font-bold">{loading ? '...' : (stats?.totalPointsRedeemed ?? 0).toLocaleString('id-ID')}</p>
              <p className="text-xs text-muted-foreground">Poin Ditukar</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-purple-100 p-2.5"><Award size={20} className="text-purple-700" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Distribusi Tier</p>
              <div className="flex gap-2 mt-1 text-xs font-medium">
                <span className="text-amber-700">🥉 {stats?.tierDistribution.bronze ?? 0}</span>
                <span className="text-gray-500">|</span>
                <span className="text-gray-600">🥈 {stats?.tierDistribution.silver ?? 0}</span>
                <span className="text-gray-500">|</span>
                <span className="text-yellow-600">🥇 {stats?.tierDistribution.gold ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Ringkasan Tier</h2>
        <div className="space-y-3">
          {[
            { tier: 'Bronze', range: '0 – 99.999 poin', color: 'bg-amber-100 text-amber-800', pct: stats ? Math.round((stats.tierDistribution.bronze / Math.max(stats.totalAccounts, 1)) * 100) : 0 },
            { tier: 'Silver', range: '100.000 – 499.999 poin', color: 'bg-gray-100 text-gray-700', pct: stats ? Math.round((stats.tierDistribution.silver / Math.max(stats.totalAccounts, 1)) * 100) : 0 },
            { tier: 'Gold', range: '500.000+ poin', color: 'bg-yellow-100 text-yellow-800', pct: stats ? Math.round((stats.tierDistribution.gold / Math.max(stats.totalAccounts, 1)) * 100) : 0 },
          ].map(t => (
            <div key={t.tier} className="flex items-center gap-4">
              <span className="w-16 text-sm font-medium">{t.tier}</span>
              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${t.color.split(' ')[0]}`} style={{ width: `${t.pct}%` }} />
              </div>
              <span className="w-12 text-xs text-right text-muted-foreground">{t.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Biaya Program Loyalitas</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Setiap poin = Rp 1 nilai riil. Poin diterbitkan: Rp {(stats?.totalPointsIssued ?? 0).toLocaleString('id-ID')}.
          {' '}Poin ditukar: Rp {(stats?.totalPointsRedeemed ?? 0).toLocaleString('id-ID')}.
        </p>
        <p className="text-xs text-muted-foreground">
          Poin aktif (belum ditukar): Rp {((stats?.totalPointsIssued ?? 0) - (stats?.totalPointsRedeemed ?? 0)).toLocaleString('id-ID')}
        </p>
      </div>
    </div>
  );
}
