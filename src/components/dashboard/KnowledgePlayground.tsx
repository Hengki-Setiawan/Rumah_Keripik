'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';

type PlaygroundResult = { answer: string; provider: string; model: string; chunks: Array<{ id: string | number; judul: string; teks: string; kategori: string; score: number }> };

export function KnowledgePlayground() {
  const [question, setQuestion] = useState('Berapa cara bayar dan apakah bisa COD?');
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function test() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/dashboard/knowledge-base/playground', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) });
      const data = await res.json();
      if (data.ok) setResult(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-surface-container-lowest p-6 shadow-sm">
      <h2 className="font-headline-sm text-headline-sm text-on-surface">Playground Jawaban AI</h2>
      <p className="mt-1 text-sm text-on-surface-variant">Tes pertanyaan, lihat jawaban AI dan source KB yang dipakai.</p>
      <div className="mt-4 flex gap-2"><input value={question} onChange={(event) => setQuestion(event.target.value)} className="flex-1 rounded-lg border border-outline-variant px-3 py-2 outline-none focus:border-primary" /><button onClick={test} disabled={loading || question.trim().length < 3} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-bold text-on-primary disabled:opacity-60"><Send size={16} /> Test</button></div>
      {result && <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]"><div className="rounded-xl bg-surface-cream p-4"><p className="text-xs font-bold text-on-surface-variant">{result.provider} • {result.model}</p><p className="mt-2 whitespace-pre-wrap font-semibold text-on-surface">{result.answer}</p></div><div className="space-y-2">{result.chunks.map((chunk, index) => <div key={`${chunk.id}-${index}`} className="rounded-lg border border-outline-variant/20 bg-white p-3 text-xs"><p className="font-bold text-on-surface">[{index + 1}] {chunk.judul}</p><p className="mt-1 line-clamp-3 text-on-surface-variant">{chunk.teks}</p><p className="mt-1 font-bold text-primary">Score: {Number(chunk.score || 0).toFixed(2)}</p></div>)}{result.chunks.length === 0 && <p className="text-sm text-on-surface-variant">Tidak ada source relevan.</p>}</div></div>}
    </div>
  );
}
