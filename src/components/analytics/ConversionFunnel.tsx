'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, MessageSquare, ShoppingCart, CreditCard, CheckCircle, Loader2 } from 'lucide-react';

interface FunnelStep {
  label: string;
  count: number;
  color: string;
  icon: React.ReactNode;
}

interface FunnelData {
  total_chat: number;
  total_order_dimulai: number;
  total_draft_disimpan: number;
  total_bukti_diterima: number;
  total_lunas: number;
}

export function ConversionFunnel() {
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/analytics/bot/performance');
        if (res.ok) {
          const d = await res.json();
          setData(d.funnel || null);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-5 shadow-sm">
        <h3 className="font-label-md text-label-md text-on-surface mb-4">Funnel Konversi Chat → Order</h3>
        <div className="flex items-center justify-center py-8 text-on-surface-variant">
          <Loader2 size={24} className="animate-spin" />
        </div>
      </div>
    );
  }

  // Fallback jika API belum support funnel data
  const fallback: FunnelData = data || {
    total_chat: 0,
    total_order_dimulai: 0,
    total_draft_disimpan: 0,
    total_bukti_diterima: 0,
    total_lunas: 0,
  };

  const steps: FunnelStep[] = [
    {
      label: 'Percakapan Masuk',
      count: fallback.total_chat,
      color: 'bg-blue-500',
      icon: <MessageSquare size={16} className="text-blue-600" />,
    },
    {
      label: 'Mulai Order',
      count: fallback.total_order_dimulai,
      color: 'bg-violet-500',
      icon: <ShoppingCart size={16} className="text-violet-600" />,
    },
    {
      label: 'Draft Tersimpan',
      count: fallback.total_draft_disimpan,
      color: 'bg-orange-500',
      icon: <CreditCard size={16} className="text-orange-600" />,
    },
    {
      label: 'Bukti Diterima',
      count: fallback.total_bukti_diterima,
      color: 'bg-yellow-500',
      icon: <CreditCard size={16} className="text-yellow-600" />,
    },
    {
      label: 'Lunas / Selesai',
      count: fallback.total_lunas,
      color: 'bg-green-500',
      icon: <CheckCircle size={16} className="text-green-600" />,
    },
  ];

  const maxCount = Math.max(...steps.map((s) => s.count), 1);

  function getConversionRate(from: number, to: number): string {
    if (!from) return '0%';
    return `${((to / from) * 100).toFixed(1)}%`;
  }

  const isEmpty = steps.every((s) => s.count === 0);

  return (
    <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-label-md text-label-md text-on-surface">Funnel Konversi Chat → Order</h3>
        <span className="text-xs text-on-surface-variant">30 hari terakhir</span>
      </div>

      {isEmpty ? (
        <div className="text-center py-8 text-on-surface-variant">
          <ArrowRight size={36} className="mx-auto mb-2 text-outline-variant" />
          <p className="text-sm">Belum ada data konversi</p>
          <p className="text-xs mt-1">Data akan muncul seiring aktivitas chatbot</p>
        </div>
      ) : (
        <div className="space-y-3">
          {steps.map((step, i) => {
            const widthPct = (step.count / maxCount) * 100;
            const convRate = i > 0
              ? getConversionRate(steps[i - 1].count, step.count)
              : null;

            return (
              <div key={i} className="space-y-1.5">
                {/* Conversion arrow */}
                {convRate && (
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant pl-2">
                    <ArrowRight size={12} />
                    <span>Konversi: <span className="font-semibold text-primary">{convRate}</span></span>
                  </div>
                )}

                {/* Bar */}
                <div className="flex items-center gap-3">
                  <div className="shrink-0">{step.icon}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-on-surface">{step.label}</span>
                      <span className="text-xs font-bold text-on-surface">{step.count.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${step.color}`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Overall conversion rate */}
          <div className="pt-3 border-t border-outline-variant/10 mt-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-on-surface-variant">Konversi Total (Chat → Lunas)</span>
              <span className="text-sm font-bold text-green-600">
                {getConversionRate(fallback.total_chat, fallback.total_lunas)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
