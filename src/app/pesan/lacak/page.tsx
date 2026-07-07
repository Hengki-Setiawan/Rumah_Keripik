'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { ArrowRight, MapPinned, Search, ShieldCheck, UserRound } from 'lucide-react';
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
    no_hp_penerima: string | null;
    alamat_penerima: string | null;
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(240,180,41,0.16),transparent_24%),radial-gradient(circle_at_85%_15%,rgba(127,159,62,0.10),transparent_18%),linear-gradient(180deg,#faf6ef_0%,#fffaf4_100%)] px-5 py-8 text-[#2f241c]">
      <section className="mx-auto max-w-5xl rounded-[2rem] border border-[#f0dfca] bg-[rgba(255,250,244,0.9)] p-6 shadow-[0_16px_44px_rgba(47,36,28,0.08)] backdrop-blur-xl md:p-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-[#9a8672]">Lacak pesanan</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] md:text-5xl">Cek status dengan aman.</h1>
            <p className="mt-3 max-w-2xl text-[#6f5d4f]">
              Masukkan kode pesanan dan nomor HP yang dipakai saat checkout. Jika datang dari link sukses,
              token status juga bisa dipakai untuk akses yang lebih aman.
            </p>
          </div>
          <Link
            href="/pesan"
            className="inline-flex items-center gap-2 rounded-full bg-[#c55a2b] px-5 py-3 text-center font-medium text-white shadow-[0_14px_30px_rgba(197,90,43,0.16)] transition hover:bg-[#ae4d23]"
          >
            Pesan lagi <ArrowRight size={16} />
          </Link>
        </div>

        <div className="mt-8 grid gap-3 rounded-[1.7rem] border border-[#ead7bf] bg-[rgba(255,248,239,0.88)] p-5 md:grid-cols-[1fr_1fr]">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#4f4034]">Kode pesanan</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Contoh: PESANAN-ABC123"
              autoComplete="off"
              className="w-full rounded-[1.2rem] border border-[#e1cfb9] bg-white px-4 py-3 outline-none transition focus:border-[#c55a2b]/30 focus:ring-4 focus:ring-[#c55a2b]/5"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#4f4034]">Nomor HP</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Contoh: 08123456789"
              inputMode="tel"
              autoComplete="tel"
              className="w-full rounded-[1.2rem] border border-[#e1cfb9] bg-white px-4 py-3 outline-none transition focus:border-[#c55a2b]/30 focus:ring-4 focus:ring-[#c55a2b]/5"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-[#4f4034]">Token status opsional</span>
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Isi kalau link sukses memberi token"
              autoComplete="off"
              className="w-full rounded-[1.2rem] border border-[#e1cfb9] bg-white px-4 py-3 outline-none transition focus:border-[#c55a2b]/30 focus:ring-4 focus:ring-[#c55a2b]/5"
            />
          </label>
          <button
            type="button"
            onClick={track}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-[1.2rem] bg-[#2f241c] px-5 py-4 font-medium text-white shadow-[0_12px_24px_rgba(47,36,28,0.12)] disabled:opacity-60 md:col-span-2"
          >
            <Search size={18} /> {isPending ? 'Mengecek...' : 'Lacak Pesanan'}
          </button>
        </div>

        {error && <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}

        {result && (
          <section className="mt-6 space-y-5 rounded-[1.7rem] border border-[#ead7bf] bg-[rgba(255,250,244,0.9)] p-5 shadow-[0_10px_26px_rgba(47,36,28,0.04)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-[#7a6758]">Kode pesanan</p>
                <h2 className="text-3xl font-semibold tracking-[-0.03em]">{result.order.kode_pesanan || result.order.id_transaksi}</h2>
                <p className="mt-1 text-sm text-[#7a6758]">Penerima: {result.order.nama_penerima || '-'}</p>
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

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[1.3rem] border border-[#ead7bf] bg-[#fffaf3] p-4">
                <div className="flex items-center gap-2">
                  <UserRound size={16} className="text-[#7f9f3e]" />
                  <h3 className="font-semibold text-[#2f241c]">Informasi penerima</h3>
                </div>
                <div className="mt-3 space-y-2 text-sm text-[#5f4d3f]">
                  <p><span className="text-[#8a7562]">Nama:</span> {result.order.nama_penerima || '-'}</p>
                  <p><span className="text-[#8a7562]">Nomor:</span> {result.order.no_hp_penerima || '-'}</p>
                  <p><span className="text-[#8a7562]">Metode bayar:</span> {result.order.payment_method || '-'}</p>
                </div>
              </div>
              <div className="rounded-[1.3rem] border border-[#ead7bf] bg-[#fffaf3] p-4">
                <div className="flex items-center gap-2">
                  <MapPinned size={16} className="text-[#c55a2b]" />
                  <h3 className="font-semibold text-[#2f241c]">Alamat pengiriman</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#5f4d3f]">
                  {result.order.alamat_penerima || 'Alamat belum tersedia di data pesanan ini.'}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold">Ringkasan item</h3>
              <div className="mt-3 space-y-2">
                {result.items.map((item) => (
                  <div key={`${item.id_produk}-${item.nama_produk}`} className="flex justify-between gap-4 rounded-[1.2rem] bg-[#fbf2e7] p-4 text-sm">
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
                  <div key={event.id} className="rounded-[1.2rem] border border-[#ead7bf] bg-[#fffaf3] p-3 text-sm">
                    <b>{event.event_type.replace(/_/g, ' ')}</b>
                    <p className="text-xs text-[#7a6758]">{new Date(event.created_at).toLocaleString('id-ID')}</p>
                  </div>
                ))}
                {result.events.length === 0 && <p className="text-sm text-[#7a6758]">Timeline belum tersedia.</p>}
              </div>
            </div>

            <div className="rounded-[1.3rem] border border-dashed border-[#e3cfb6] bg-[rgba(255,248,239,0.84)] p-4">
              <p className="text-sm font-medium text-[#2f241c]">Perlu ubah nama, alamat, atau catatan?</p>
              <p className="mt-1 text-sm leading-6 text-[#6f5d4f]">
                Bisa langsung kembali ke chat dan tulis misalnya: <b>&quot;ubah alamat pengiriman saya&quot;</b> atau <b>&quot;ganti nomor penerima&quot;</b>.
              </p>
              <div className="mt-3">
                <Link href="/pesan" className="inline-flex items-center gap-2 rounded-full border border-[#ecd8bf] bg-white px-4 py-2 text-sm font-medium text-[#2f241c] transition hover:bg-[#f7eddf]">
                  Buka chat AI <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.3rem] bg-[linear-gradient(135deg,#2f241c_0%,#4b382d_100%)] p-5 text-white shadow-[0_14px_30px_rgba(47,36,28,0.14)]">
      <p className="text-sm text-white/60">{label}</p>
      <p className="mt-2 break-words text-xl font-semibold">{value.replace(/_/g, ' ')}</p>
    </div>
  );
}
