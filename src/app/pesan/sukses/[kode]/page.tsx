import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { CheckCircle2, ClipboardList, MessageCircle, PackageCheck } from 'lucide-react';
import { db } from '@/lib/db';
import { transaksi } from '@/lib/schema';
import { formatRupiah } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ kode: string }>;
};

export default async function OrderSuccessPage({ params }: PageProps) {
  const { kode } = await params;
  const decodedCode = decodeURIComponent(kode);
  const [order] = await db
    .select()
    .from(transaksi)
    .where(eq(transaksi.kode_pesanan, decodedCode))
    .limit(1);

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#fff7df,#ffe6a7,#f8cf72)] px-5 py-8 text-[#241306]">
      <section className="mx-auto flex min-h-[80vh] max-w-3xl items-center">
        <div className="w-full rounded-[2rem] border border-[#e0bd82] bg-white/85 p-6 shadow-2xl shadow-[#8d4b00]/15 backdrop-blur md:p-10">
          <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-[#1f7a3d] text-white">
            <CheckCircle2 size={42} />
          </div>

          <div className="text-center">
            <p className="text-sm font-black uppercase tracking-[0.28em] text-[#8d4b00]">Pesanan dibuat</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] md:text-5xl">
              Admin Rumah Keripik akan cek pesananmu.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[#6b4a2e]">
              Simpan kode pesanan ini untuk lacak status. Jika memilih transfer, siapkan bukti bayar saat admin mengonfirmasi.
            </p>
          </div>

          <div className="mt-8 rounded-[1.5rem] bg-[#2a1606] p-6 text-white">
            <p className="text-sm font-bold text-white/65">Kode pesanan</p>
            <p className="mt-2 break-all text-3xl font-black">{decodedCode}</p>
            {order && (
              <div className="mt-5 grid gap-3 border-t border-white/15 pt-5 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-white/65">Total produk</p>
                  <p className="text-xl font-black">{formatRupiah(order.total_bayar)}</p>
                </div>
                <div>
                  <p className="text-sm text-white/65">Status</p>
                  <p className="text-xl font-black">{order.status_pembayaran.replace(/_/g, ' ')}</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-[#ecd3a7] bg-[#fff8e8] p-4">
              <ClipboardList className="mb-3 text-[#8d4b00]" />
              <p className="font-black">Order masuk dashboard</p>
              <p className="mt-1 text-sm text-[#735033]">Admin bisa cek item, alamat, dan status.</p>
            </div>
            <div className="rounded-3xl border border-[#ecd3a7] bg-[#fff8e8] p-4">
              <MessageCircle className="mb-3 text-[#8d4b00]" />
              <p className="font-black">Tunggu konfirmasi</p>
              <p className="mt-1 text-sm text-[#735033]">Admin akan menghubungi jika ada detail kurang.</p>
            </div>
            <div className="rounded-3xl border border-[#ecd3a7] bg-[#fff8e8] p-4">
              <PackageCheck className="mb-3 text-[#8d4b00]" />
              <p className="font-black">Pesanan diproses</p>
              <p className="mt-1 text-sm text-[#735033]">Stok dipotong setelah admin verifikasi.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/api/order/track?code=${encodeURIComponent(decodedCode)}`}
              className="flex-1 rounded-2xl bg-[#8d4b00] px-5 py-4 text-center font-black text-white transition hover:bg-[#6f3900]"
            >
              Lihat data tracking
            </Link>
            <Link
              href="/pesan"
              className="flex-1 rounded-2xl border border-[#d8b77c] bg-white px-5 py-4 text-center font-black text-[#7a3f00] transition hover:bg-[#fff4d6]"
            >
              Buat pesanan lagi
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
