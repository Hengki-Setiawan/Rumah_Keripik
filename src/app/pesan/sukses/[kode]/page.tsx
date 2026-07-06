import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { CheckCircle2, ClipboardList, MessageCircle, PackageCheck } from 'lucide-react';
import { db } from '@/lib/db';
import { detailTransaksi, paymentIntent, transaksi } from '@/lib/schema';
import { formatRupiah } from '@/lib/utils';
import { PaymentProofUploader } from '@/components/order/PaymentProofUploader';
import { PaymentInstructionCard } from '@/components/order/PaymentInstructionCard';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ kode: string }>;
  searchParams?: Promise<{ token?: string }>;
};

export default async function OrderSuccessPage({ params, searchParams }: PageProps) {
  const { kode } = await params;
  const query = await searchParams;
  const decodedCode = decodeURIComponent(kode);
  const [order] = await db
    .select()
    .from(transaksi)
    .where(eq(transaksi.kode_pesanan, decodedCode))
    .limit(1);
  const [intent, items] = order
    ? await Promise.all([
        db.select().from(paymentIntent).where(eq(paymentIntent.id_transaksi, order.id_transaksi)).limit(1).then((rows) => rows[0]),
        db.select().from(detailTransaksi).where(eq(detailTransaksi.id_transaksi, order.id_transaksi)),
      ])
    : [undefined, []];
  const hasValidToken = !order?.status_token || query?.token === order.status_token;
  const instruction = parseInstruction(intent?.instruction_json);

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#fff7df,#ffe6a7,#f8cf72)] px-5 py-8 text-[#241306]">
      <section className="mx-auto flex min-h-[80vh] max-w-4xl items-center">
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
              Simpan kode pesanan ini untuk lacak status. Jika memilih transfer atau QRIS, upload bukti bayar agar admin bisa cek pembayaran.
            </p>
          </div>

          <div className="mt-8 rounded-[1.5rem] bg-[#2a1606] p-6 text-white">
            <p className="text-sm font-bold text-white/65">Kode pesanan</p>
            <p className="mt-2 break-all text-3xl font-black">{decodedCode}</p>
            {order && hasValidToken && (
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

          {items.length > 0 && hasValidToken && (
            <section className="mt-6 rounded-3xl border border-[#ecd3a7] bg-[#fffaf0] p-5">
              <h2 className="text-xl font-black text-[#2a1606]">Ringkasan item</h2>
              <div className="mt-4 space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4">
                    <div>
                      <p className="font-black">{item.nama_produk_snapshot || item.id_produk}</p>
                      {item.nama_varian_snapshot && <p className="text-sm font-bold text-[#795735]">{item.nama_varian_snapshot}</p>}
                      <p className="text-sm text-[#795735]">Qty {item.qty_terjual}</p>
                    </div>
                    <p className="font-black text-[#8d4b00]">{formatRupiah(item.subtotal)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {order && order.status_token && hasValidToken && order.payment_status !== 'verified' && order.payment_method !== 'cod' && (
            <>
              <PaymentInstructionCard amount={order.total_bayar} instruction={instruction} />
              <PaymentProofUploader orderId={order.id_transaksi} statusToken={order.status_token} />
            </>
          )}

          {order?.status_token && !hasValidToken && (
            <div className="mt-6 rounded-[1.5rem] border border-amber-300 bg-amber-50 p-5 text-sm font-bold text-amber-800">
              Link ini membutuhkan token pesanan untuk menampilkan detail dan upload bukti pembayaran. Gunakan link sukses/status dari proses checkout terakhir.
            </div>
          )}

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-[#ecd3a7] bg-[#fff8e8] p-4">
              <ClipboardList className="mb-3 text-[#8d4b00]" />
              <p className="font-black">Order diterima admin</p>
              <p className="mt-1 text-sm text-[#735033]">Item, alamat, dan catatan pesanan sudah diterima.</p>
            </div>
            <div className="rounded-3xl border border-[#ecd3a7] bg-[#fff8e8] p-4">
              <MessageCircle className="mb-3 text-[#8d4b00]" />
              <p className="font-black">Tunggu konfirmasi</p>
              <p className="mt-1 text-sm text-[#735033]">Admin akan menghubungi jika ada detail kurang.</p>
            </div>
            <div className="rounded-3xl border border-[#ecd3a7] bg-[#fff8e8] p-4">
              <PackageCheck className="mb-3 text-[#8d4b00]" />
              <p className="font-black">Pesanan diproses</p>
              <p className="mt-1 text-sm text-[#735033]">Pesanan berjalan setelah pembayaran atau COD disetujui.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/pesan/status/${encodeURIComponent(decodedCode)}${query?.token || order?.status_token ? `?token=${encodeURIComponent(query?.token || order?.status_token || '')}` : ''}`}
              className="flex-1 rounded-2xl bg-[#8d4b00] px-5 py-4 text-center font-black text-white transition hover:bg-[#6f3900]"
            >
              Lihat status pesanan
            </Link>
            <Link
              href="/pesan/lacak"
              className="flex-1 rounded-2xl border border-[#d8b77c] bg-[#fff8e8] px-5 py-4 text-center font-black text-[#7a3f00] transition hover:bg-[#fff4d6]"
            >
              Lacak dengan HP
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

function parseInstruction(value: string | null | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value) as { type?: string; label?: string; accountName?: string; accountNumber?: string; bankName?: string; qrisImageUrl?: string; note?: string };
  } catch {
    return null;
  }
}
