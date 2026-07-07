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
    <main className="min-h-screen bg-[#fafafa] px-5 py-8 text-[#111827]">
      <section className="mx-auto flex min-h-[80vh] max-w-4xl items-center">
        <div className="w-full rounded-[2rem] border border-[#e5e7eb] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)] md:p-10">
          <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-[#10a37f] text-white">
            <CheckCircle2 size={42} />
          </div>

          <div className="text-center">
            <p className="text-sm font-medium text-[#6b7280]">Pesanan dibuat</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
              Admin Rumah Keripik akan cek pesananmu.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[#6b7280]">
              Simpan kode pesanan ini untuk lacak status. Jika memilih transfer atau QRIS, upload bukti bayar agar admin bisa cek pembayaran.
            </p>
          </div>

          <div className="mt-8 rounded-[1.5rem] bg-[#111827] p-6 text-white">
            <p className="text-sm text-white/65">Kode pesanan</p>
            <p className="mt-2 break-all text-3xl font-semibold tracking-[-0.03em]">{decodedCode}</p>
            {order && hasValidToken && (
              <div className="mt-5 grid gap-3 border-t border-white/15 pt-5 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-white/65">Total produk</p>
                  <p className="text-xl font-semibold">{formatRupiah(order.total_bayar)}</p>
                </div>
                <div>
                  <p className="text-sm text-white/65">Status</p>
                  <p className="text-xl font-semibold">{order.status_pembayaran.replace(/_/g, ' ')}</p>
                </div>
              </div>
            )}
          </div>

          {items.length > 0 && hasValidToken && (
            <section className="mt-6 rounded-3xl border border-[#e5e7eb] bg-[#f7f7f8] p-5">
              <h2 className="text-xl font-semibold text-[#111827]">Ringkasan item</h2>
              <div className="mt-4 space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4">
                    <div>
                      <p className="font-medium">{item.nama_produk_snapshot || item.id_produk}</p>
                      {item.nama_varian_snapshot && <p className="text-sm text-[#6b7280]">{item.nama_varian_snapshot}</p>}
                      <p className="text-sm text-[#6b7280]">Qty {item.qty_terjual}</p>
                    </div>
                    <p className="font-semibold text-[#111827]">{formatRupiah(item.subtotal)}</p>
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
            <div className="mt-6 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
              Link ini membutuhkan token pesanan untuk menampilkan detail dan upload bukti pembayaran. Gunakan link sukses/status dari proses checkout terakhir.
            </div>
          )}

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-[#e5e7eb] bg-[#f7f7f8] p-4">
              <ClipboardList className="mb-3 text-[#6b7280]" />
              <p className="font-semibold">Order diterima admin</p>
              <p className="mt-1 text-sm text-[#6b7280]">Item, alamat, dan catatan pesanan sudah diterima.</p>
            </div>
            <div className="rounded-3xl border border-[#e5e7eb] bg-[#f7f7f8] p-4">
              <MessageCircle className="mb-3 text-[#6b7280]" />
              <p className="font-semibold">Tunggu konfirmasi</p>
              <p className="mt-1 text-sm text-[#6b7280]">Admin akan menghubungi jika ada detail kurang.</p>
            </div>
            <div className="rounded-3xl border border-[#e5e7eb] bg-[#f7f7f8] p-4">
              <PackageCheck className="mb-3 text-[#6b7280]" />
              <p className="font-semibold">Pesanan diproses</p>
              <p className="mt-1 text-sm text-[#6b7280]">Pesanan berjalan setelah pembayaran atau COD disetujui.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/pesan/status/${encodeURIComponent(decodedCode)}${query?.token || order?.status_token ? `?token=${encodeURIComponent(query?.token || order?.status_token || '')}` : ''}`}
              className="flex-1 rounded-2xl bg-[#111827] px-5 py-4 text-center font-medium text-white transition hover:bg-[#374151]"
            >
              Lihat status pesanan
            </Link>
            <Link
              href="/pesan/lacak"
              className="flex-1 rounded-2xl border border-[#e5e7eb] bg-[#f7f7f8] px-5 py-4 text-center font-medium text-[#111827] transition hover:bg-[#f3f4f6]"
            >
              Lacak dengan HP
            </Link>
            <Link
              href="/pesan"
              className="flex-1 rounded-2xl border border-[#e5e7eb] bg-white px-5 py-4 text-center font-medium text-[#111827] transition hover:bg-[#f3f4f6]"
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
