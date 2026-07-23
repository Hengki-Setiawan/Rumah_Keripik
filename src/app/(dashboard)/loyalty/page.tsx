'use client';

import { useEffect, useState } from 'react';
import { Gift, Users, TrendingUp, Award, Copy, Check } from 'lucide-react';

interface LoyaltyStats {
  totalAccounts: number;
  tierDistribution: { bronze: number; silver: number; gold: number };
  totalPointsIssued: number;
  totalPointsRedeemed: number;
  recentRedemptions: Array<{ id: string; customerId: string; points: number; createdAt: string }>;
}

export default function LoyaltyPage() {
  const [stats, setStats] = useState<LoyaltyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/loyalty/stats').then((r) => r.json()),
    ]).then(([data]) => {
      if (data.ok) setStats(data.stats);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-gray-500">Memuat data loyalitas...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Gift /> Loyalitas & Referral</h1>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <Users size={20} className="text-blue-500 mb-1" />
          <div className="text-2xl font-bold">{stats?.totalAccounts || 0}</div>
          <div className="text-sm text-gray-500">Total Akun</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <Award size={20} className="text-amber-500 mb-1" />
          <div className="text-2xl font-bold">{stats?.tierDistribution?.gold || 0}</div>
          <div className="text-sm text-gray-500">Gold</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <TrendingUp size={20} className="text-emerald-500 mb-1" />
          <div className="text-2xl font-bold">{stats?.totalPointsIssued?.toLocaleString() || 0}</div>
          <div className="text-sm text-gray-500">Poin Diterbitkan</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <Copy size={20} className="text-purple-500 mb-1" />
          <div className="text-2xl font-bold">{stats?.totalPointsRedeemed?.toLocaleString() || 0}</div>
          <div className="text-sm text-gray-500">Poin Ditukar</div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <h2 className="font-semibold mb-3">Distribusi Tier</h2>
        {stats?.tierDistribution ? (
          <div className="space-y-2">
            {(['bronze', 'silver', 'gold'] as const).map((tier) => {
              const count = stats.tierDistribution[tier] || 0;
              const total = Object.values(stats.tierDistribution).reduce((a, b) => a + b, 0) || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={tier} className="flex items-center gap-3">
                  <span className="w-16 text-sm capitalize">{tier}</span>
                  <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${tier === 'gold' ? 'bg-amber-400' : tier === 'silver' ? 'bg-gray-400' : 'bg-amber-700'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm text-gray-500 w-16 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        ) : <div className="text-gray-400 text-sm">Belum ada data</div>}
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <h2 className="font-semibold mb-3">Referral Code</h2>
        <p className="text-sm text-gray-500 mb-2">Kode referral otomatis dibuat saat akun loyalitas dibuat.</p>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Check size={16} className="text-emerald-500" />
          Bonus: 5.000 poin pengaju + 2.500 poin yang diajak
        </div>
      </div>
    </div>
  );
}
