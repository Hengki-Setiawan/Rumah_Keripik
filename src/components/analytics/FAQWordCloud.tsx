'use client';

import { useState, useEffect } from 'react';
import { HelpCircle, Loader2, TrendingUp } from 'lucide-react';

interface FAQItem {
  question: string;
  count: number;
}

interface FAQWordCloudProps {
  days?: number;
}

/** Warna berbeda untuk kata-kata berdasarkan frekuensi */
const CLOUD_COLORS = [
  'text-violet-600',
  'text-blue-600',
  'text-green-600',
  'text-orange-600',
  'text-pink-600',
  'text-cyan-600',
  'text-red-600',
  'text-indigo-600',
];

export function FAQWordCloud({ days = 7 }: FAQWordCloudProps) {
  const [questions, setQuestions] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/analytics/bot/top-questions?days=${days}`);
        if (res.ok) {
          const data = await res.json();
          setQuestions(data.questions || []);
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
  }, [days]);

  const maxCount = Math.max(...questions.map((q) => q.count), 1);

  /** Skala font antara 0.8rem dan 1.8rem berdasarkan frekuensi relatif */
  function getFontSize(count: number): string {
    const ratio = count / maxCount;
    const size = 0.8 + ratio * 1.0;
    return `${size.toFixed(2)}rem`;
  }

  function getFontWeight(count: number): string {
    const ratio = count / maxCount;
    if (ratio > 0.7) return 'font-bold';
    if (ratio > 0.4) return 'font-semibold';
    return 'font-medium';
  }

  if (loading) {
    return (
      <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle size={16} className="text-primary" />
          <h3 className="font-label-md text-label-md text-on-surface">Pertanyaan Terpopuler</h3>
        </div>
        <div className="flex items-center justify-center py-8 text-on-surface-variant">
          <Loader2 size={24} className="animate-spin" />
        </div>
      </div>
    );
  }

  if (error || questions.length === 0) {
    return (
      <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle size={16} className="text-primary" />
          <h3 className="font-label-md text-label-md text-on-surface">Pertanyaan Terpopuler</h3>
        </div>
        <div className="text-center py-8 text-on-surface-variant">
          <HelpCircle size={36} className="mx-auto mb-2 text-outline-variant" />
          <p className="text-sm">
            {error ? 'Gagal memuat data' : 'Belum ada data pertanyaan'}
          </p>
          <p className="text-xs mt-1">Data muncul seiring aktivitas chatbot</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HelpCircle size={16} className="text-primary" />
          <h3 className="font-label-md text-label-md text-on-surface">Pertanyaan Terpopuler</h3>
        </div>
        <span className="text-xs text-on-surface-variant">
          {days === 1 ? 'Hari ini' : `${days} hari terakhir`}
        </span>
      </div>

      {/* Word Cloud */}
      <div className="flex flex-wrap gap-2 items-center justify-center min-h-32 p-4 bg-surface-container rounded-xl">
        {questions.map((q, i) => (
          <span
            key={i}
            className={`cursor-default select-none transition-all hover:opacity-75 px-2 py-1 rounded-lg hover:bg-surface-container-high ${
              CLOUD_COLORS[i % CLOUD_COLORS.length]
            } ${getFontWeight(q.count)}`}
            style={{ fontSize: getFontSize(q.count) }}
            title={`${q.count}x ditanyakan`}
          >
            {q.question.length > 40 ? q.question.substring(0, 40) + '…' : q.question}
          </span>
        ))}
      </div>

      {/* Ranked List */}
      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Ranking Pertanyaan</p>
        {questions.slice(0, 5).map((q, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-5 h-5 rounded-full bg-surface-container flex items-center justify-center font-bold text-on-surface-variant shrink-0">
              {i + 1}
            </span>
            <span className="flex-1 text-on-surface truncate">{q.question}</span>
            <span className="flex items-center gap-0.5 text-primary font-semibold shrink-0">
              <TrendingUp size={10} />
              {q.count}x
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
