'use client';

import { useState, useEffect } from 'react';

interface BotPerformance {
  total_pesan: number;
  rule_persen: number;
  groq_persen: number;
  gemini_persen: number;
  not_found_persen: number;
  avg_response_ms: number;
}

interface TopQuestion {
  pertanyaan: string;
  count: number;
}

export function BotPerformancePanel() {
  const [performance, setPerformance] = useState<BotPerformance | null>(null);
  const [topQuestions, setTopQuestions] = useState<TopQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [perfRes, topRes] = await Promise.all([
          fetch('/api/analytics/bot/performance'),
          fetch('/api/analytics/bot/top-questions'),
        ]);
        if (perfRes.ok) {
          const data = await perfRes.json();
          setPerformance(data);
        }
        if (topRes.ok) {
          const data = await topRes.json();
          setTopQuestions(data.questions || []);
        }
      } catch (err) {
        console.error('[BotAnalytics]', err);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-32 bg-surface-container rounded-xl" />
        <div className="h-48 bg-surface-container rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-surface-container-lowest border rounded-xl p-4">
          <p className="text-2xl font-bold">{performance?.total_pesan || 0}</p>
          <p className="text-xs text-on-surface-variant">Total Pesan</p>
        </div>
        <div className="bg-surface-container-lowest border rounded-xl p-4">
          <p className="text-2xl font-bold text-green-600">{performance?.rule_persen || 0}%</p>
          <p className="text-xs text-on-surface-variant">Rule (Instant)</p>
        </div>
        <div className="bg-surface-container-lowest border rounded-xl p-4">
          <p className="text-2xl font-bold text-blue-600">{performance?.groq_persen || 0}%</p>
          <p className="text-xs text-on-surface-variant">AI (Groq)</p>
        </div>
        <div className="bg-surface-container-lowest border rounded-xl p-4">
          <p className="text-2xl font-bold text-purple-600">{performance?.gemini_persen || 0}%</p>
          <p className="text-xs text-on-surface-variant">AI (Gemini)</p>
        </div>
        <div className="bg-surface-container-lowest border rounded-xl p-4">
          <p className="text-2xl font-bold">
            {performance?.avg_response_ms ? `${performance.avg_response_ms}ms` : '-'}
          </p>
          <p className="text-xs text-on-surface-variant">Rata-rata Respon</p>
        </div>
      </div>

      {topQuestions.length > 0 && (
        <div className="bg-surface-container-lowest border rounded-xl p-4">
          <h3 className="font-medium mb-3">Top Pertanyaan Pelanggan</h3>
          <div className="space-y-2">
            {topQuestions.map((q, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="truncate mr-2">{q.pertanyaan}</span>
                <span className="text-on-surface-variant shrink-0 font-mono text-xs">
                  {q.count}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
