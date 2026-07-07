'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { tambahKnowledgeBase } from '@/actions/knowledge-base';

const categories = [
  'FAQ',
  'Product Rule',
  'Shipping Rule',
  'Payment Rule',
  'Promo',
  'Persona',
  'Safety Rule',
  'Fallback',
];

const templates: Record<string, string> = {
  FAQ: 'Pertanyaan:\nJawaban singkat toko:',
  'Product Rule': 'Aturan rekomendasi produk:\nCocok untuk:\nJangan rekomendasikan jika:',
  'Shipping Rule': 'Aturan pengiriman:\nArea layanan:\nEstimasi:\nCatatan admin:',
  'Payment Rule': 'Aturan pembayaran:\nMetode:\nInstruksi:\nKapan perlu admin:',
  Promo: 'Promo:\nSyarat:\nPeriode:\nProduk terkait:',
  Persona: 'Gaya bicara AI:\nSapaan:\nBatasan:',
  'Safety Rule': 'Aturan keamanan:\nYang boleh dijawab:\nYang harus handoff admin:',
  Fallback: 'Jika AI tidak yakin:\nBalasan aman:\nAksi berikutnya:',
};

export function KnowledgeV3QuickAdd() {
  const [category, setCategory] = useState(categories[0]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(templates[categories[0]]);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  function changeCategory(next: string) {
    setCategory(next);
    if (!content.trim() || Object.values(templates).includes(content)) setContent(templates[next] || '');
  }

  function submit() {
    setMessage('');
    startTransition(async () => {
      const result = await tambahKnowledgeBase(title, content, category);
      setMessage(result.message || (result.success ? 'Knowledge tersimpan.' : 'Gagal menyimpan knowledge.'));
      if (result.success) {
        setTitle('');
        setContent(templates[category] || '');
      }
    });
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-surface-container-lowest p-6 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Quick Add Knowledge V3</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Tambah aturan FAQ, pembayaran, pengiriman, promo, persona, safety, atau fallback langsung ke RAG.</p>
        </div>
        <button onClick={submit} disabled={pending || title.trim().length < 3 || content.trim().length < 20} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-bold text-on-primary disabled:opacity-60">
          <Plus size={16} /> Simpan KB
        </button>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[220px_1fr]">
        <select value={category} onChange={(event) => changeCategory(event.target.value)} className="rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-primary">
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Judul knowledge, contoh: Aturan COD area Samarinda" className="rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-primary" />
      </div>
      <textarea value={content} onChange={(event) => setContent(event.target.value)} className="mt-3 min-h-44 w-full rounded-lg border border-outline-variant bg-surface-cream p-4 text-sm font-medium outline-none focus:border-primary" />
      {message && <p className="mt-3 rounded-lg bg-primary-container/30 p-3 text-sm font-bold text-on-surface">{message}</p>}
    </section>
  );
}
