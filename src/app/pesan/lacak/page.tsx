'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';

type TrackResult = {
  order: {
    id_transaksi: string;
    kode_pesanan: string | null;
    total_bayar: number;
    status_pembayaran: string;
    order_status: string;
    payment_status: string;
    payment_method: string | null;
    nama_penerima: string | null;
    waktu_simpan: string;
    updated_at: string;
  };
  items: Array<{ id_produk: string; nama_produk: string | null; qty: number; harga: number; subtotal: number }>;
  events: Array<{ id: number; event_type: string; created_at: string }>;
};

export default function TrackOrderPage() {
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<TrackResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function track() {
    setError('');
    setResult(null);
    if (!code.trim() || (!phone.trim() && !token.trim())) {
      setError('Isi kode pesanan dan nomor HP atau token status.');
      return;
    }

    startTransition(async () => {
      const params = new URLSearchParams({ code: code.trim() });
      if (phone.trim()) params.set('phone', phone.trim());
      if (token.trim()) params.set('token', token.trim());
      const res = await fetch(`/api/order/track?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Pesanan tidak bisa dilacak. Cek kembali datanya.');
        return;
      }
      setResult(data);
    });
  }

  return (
    <main className="min-h-screen bg-[#fafafa] px-5 py-8 text-[#111827]">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-[#e5e7eb] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)] md:p-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-[#6b7280]">Lacak pesanan</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">Cek status dengan aman.</h1>
            <p className="mt-3 max-w-2xl text-[#6b7280]">Masukkan kode pesanan dan nomor HP yang dipakai saat checkout. Jika membuka dari link sukses, token status bisa dipakai untuk akses yang lebih aman.</p>
          </div>
          <Link href="/pesan" className="rounded-2xl bg-[#111827] px-5 py-3 text-center font-medium text-white">Pesan lagi</Link>
        </div>

        <div className="mt-8 grid gap-3 rounded-3xl border border-[#e5e7eb] bg-[#f7f7f8] p-5 md:grid-cols-[1fr_1fr]">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#374151]">Kode pesanan</span>
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Contoh: PESANAN-ABC123" autoComplete="off" className="w-full rounded-2xl border border-[#d1d5db] bg-white px-4 py-3 outline-none focus:border-[#111827]/30" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#374151]">Nomor HP</span>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Contoh: 08123456789" inputMode="tel" autoComplete="tel" className="w-full rounded-2xl border border-[#d1d5db] bg-white px-4 py-3 outline-none focus:border-[#111827]/30" />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-[#374151]">Token status opsional</span>
            <input value={token} onChange={(event) => setToken(event.target.value)} placeholder="Isi kalau link sukses memberi token" autoComplete="off" className="w-full rounded-2xl border border-[#d1d5db] bg-white px-4 py-3 outline-none focus:border-[#111827]/30" />
          </label>
          <button type="button" onClick={track} disabled={isPending} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#111827] px-5 py-4 font-medium text-white disabled:opacity-60 md:col-span-2">
            <Search size={18} /> {isPending ? 'Mengecek...' : 'Lacak Pesanan'}
          </button>
        </div>

        {error && <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}

        {result && (
          <section className="mt-6 space-y-5 rounded-3xl border border-[#e5e7eb] bg-white p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-[#6b7280]">Kode pesanan</p>
                <h2 className="text-3xl font-semibold tracking-[-0.03em]">{result.order.kode_pesanan || result.order.id_transaksi}</h2>
                <p className="mt-1 text-sm text-[#6b7280]">Penerima: {result.order.nama_penerima || '-'}</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
                <ShieldCheck size={16} /> Data cocok
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <StatusCard label="Order" value={result.order.order_status} />
              <StatusCard label="Pembayaran" value={result.order.payment_status} />
              <StatusCard label="Total" value={formatRupiah(result.order.total_bayar)} />
            </div>

            <div>
              <h3 className="text-lg font-semibold">Ringkasan item</h3>
              <div className="mt-3 space-y-2">
                {result.items.map((item) => (
                  <div key={`${item.id_produk}-${item.nama_produk}`} className="flex justify-between gap-4 rounded-2xl bg-[#f7f7f8] p-4 text-sm">
                    <span><b>{item.nama_produk || item.id_produk}</b> x{item.qty}</span>
                    <b>{formatRupiah(item.subtotal)}</b>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold">Timeline</h3>
              <div className="mt-3 space-y-2">
                {result.events.slice(0, 8).map((event) => (
                  <div key={event.id} className="rounded-2xl border border-[#e5e7eb] bg-[#fafafa] p-3 text-sm">
                    <b>{event.event_type.replace(/_/g, ' ')}</b>
                    <p className="text-xs text-[#6b7280]">{new Date(event.created_at).toLocaleString('id-ID')}</p>
                  </div>
                ))}
                {result.events.length === 0 && <p className="text-sm text-[#6b7280]">Timeline belum tersedia.</p>}
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-3xl bg-[#111827] p-5 text-white"><p className="text-sm text-white/60">{label}</p><p className="mt-2 break-words text-xl font-semibold">{value.replace(/_/g, ' ')}</p></div>;
}
