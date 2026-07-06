import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { detailTransaksi, orderStatusHistory, paymentIntent, paymentProof, transaksi } from '@/lib/schema';
import { formatRupiah } from '@/lib/utils';
import { PaymentProofUploader } from '@/components/order/PaymentProofUploader';
import { PaymentInstructionCard } from '@/components/order/PaymentInstructionCard';
import { canUploadPaymentProof, getCustomerStatusMessage, isPaymentVerified } from '@/lib/order-status-policy';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ kode: string }>;
  searchParams?: Promise<{ token?: string }>;
};

export default async function OrderStatusPage({ params, searchParams }: PageProps) {
  const { kode } = await params;
  const query = await searchParams;
  const decodedCode = decodeURIComponent(kode);
  const [order] = await db.select().from(transaksi).where(eq(transaksi.kode_pesanan, decodedCode)).limit(1);

  if (!order) return <StatusShell title="Pesanan tidak ditemukan" message="Cek kembali kode pesanan yang kamu masukkan." />;
  if (order.status_token && query?.token !== order.status_token) {
    return <StatusShell title="Token status diperlukan" message="Link status pesanan ini membutuhkan token verifikasi dari halaman sukses pesanan." />;
  }

  const [items, proofs, history] = await Promise.all([
    db.select().from(detailTransaksi).where(eq(detailTransaksi.id_transaksi, order.id_transaksi)),
    db.select().from(paymentProof).where(eq(paymentProof.id_transaksi, order.id_transaksi)).orderBy(desc(paymentProof.uploaded_at)),
    db.select().from(orderStatusHistory).where(eq(orderStatusHistory.id_transaksi, order.id_transaksi)).orderBy(desc(orderStatusHistory.created_at)),
  ]);
  const [intent] = await db.select().from(paymentIntent).where(eq(paymentIntent.id_transaksi, order.id_transaksi)).limit(1);

  const latestProof = proofs[0];
  const hasPendingProof = proofs.some((proof) => proof.status === 'pending');
  const canUploadProof = Boolean(order.status_token && canUploadPaymentProof(order, proofs));

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,rgba(245,158,11,0.22),transparent_28%),linear-gradient(135deg,#fff8e7,#ffe4ad,#f7c96e)] px-5 py-8 text-[#231305]">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-[#e0bd82] bg-white/90 p-6 shadow-2xl shadow-[#8d4b00]/15 backdrop-blur md:p-10">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-[#8d4b00]">Status Pesanan</p>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-[-0.04em]">{decodedCode}</h1>
            <p className="mt-2 text-[#6b4a2e]">Pantau status pesanan dan pembayaran dari halaman web ini.</p>
            <p className="mt-3 rounded-2xl bg-[#fff4d6] px-4 py-3 text-sm font-bold text-[#735033]">{getCustomerStatusMessage(order)}</p>
          </div>
          <Link href="/pesan" className="rounded-2xl bg-[#8d4b00] px-5 py-3 text-center font-black text-white">Pesan lagi</Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <StatusCard label="Order" value={order.order_status} />
          <StatusCard label="Pembayaran" value={order.payment_status} />
          <StatusCard label="Total" value={formatRupiah(order.total_bayar)} />
        </div>

        <section className="mt-6 rounded-3xl border border-[#ecd3a7] bg-[#fffaf0] p-5">
          <h2 className="text-xl font-black">Ringkasan Item</h2>
          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4">
                <div>
                  <p className="font-black">{item.nama_produk_snapshot || item.id_produk}</p>
                  {item.nama_varian_snapshot && <p className="text-sm text-[#795735]">{item.nama_varian_snapshot}</p>}
                  <p className="text-sm text-[#795735]">Qty {item.qty_terjual}</p>
                </div>
                <p className="font-black">{formatRupiah(item.subtotal)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-[#ecd3a7] bg-white p-5">
          <h2 className="text-xl font-black">Timeline pesanan</h2>
          <p className="mt-2 text-sm font-bold text-[#735033]">Riwayat ini membantu kamu melihat proses pesanan dan pembayaran.</p>
          <div className="mt-5 space-y-3">
            {history.length > 0 ? history.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-[#ecd3a7] bg-[#fffdf6] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-black text-[#2a1606]">{formatTimelineEvent(entry.event_type)}</p>
                    <p className="mt-1 text-sm font-bold text-[#735033]">
                      {[entry.order_status, entry.payment_status].filter(Boolean).map((value) => value!.replace(/_/g, ' ')).join(' / ')}
                    </p>
                    {entry.note && <p className="mt-2 text-sm text-[#735033]">{entry.note}</p>}
                  </div>
                  <p className="text-xs font-bold text-[#8c6a4c]">{new Date(entry.created_at).toLocaleString('id-ID')}</p>
                </div>
              </div>
            )) : (
              <p className="rounded-2xl bg-[#fff8e8] p-4 text-sm font-bold text-[#735033]">Timeline detail belum tersedia. Status utama tetap bisa dilihat dari kartu di atas.</p>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-[#ecd3a7] bg-white p-5">
          <h2 className="text-xl font-black">Bukti Pembayaran</h2>
          <p className="mt-2 text-[#6b4a2e]">
            {latestProof ? `Bukti pembayaran terakhir berstatus ${latestProof.status}.` : 'Belum ada bukti pembayaran yang diupload.'}
          </p>
          {hasPendingProof && order.payment_status !== 'verified' && (
            <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
              Bukti pembayaran sedang menunggu verifikasi admin. Upload ulang tersedia jika bukti ditolak.
            </p>
          )}
          {latestProof?.status === 'rejected' && latestProof.admin_note && (
            <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              Alasan penolakan: {latestProof.admin_note}
            </p>
          )}
          {canUploadProof && (
            <>
              <PaymentInstructionCard amount={order.total_bayar} instruction={parseInstruction(intent?.instruction_json)} />
              <PaymentProofUploader orderId={order.id_transaksi} statusToken={order.status_token!} />
            </>
          )}
          {!isPaymentVerified(order) && !canUploadProof && (
            <p className="mt-3 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">
              {order.payment_method === 'cod' ? 'Pesanan COD menunggu konfirmasi admin.' : 'Jika sudah membayar dan perlu bantuan, hubungi admin melalui kanal yang tersedia.'}
            </p>
          )}
          {isPaymentVerified(order) && (
            <Link href={`/dokumen/order/${encodeURIComponent(order.id_transaksi)}/receipt`} className="mt-4 inline-block rounded-2xl bg-[#1f7a3d] px-5 py-3 font-black text-white">
              Lihat bukti pembayaran
            </Link>
          )}
        </section>

        <section className="mt-6 rounded-3xl border border-[#ecd3a7] bg-[#fff8e8] p-5">
          <h2 className="text-xl font-black">Butuh bantuan?</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-[#735033]">Simpan kode pesanan ini. Jika ada kendala pembayaran atau pengiriman, admin Rumah Keripik bisa membantu mengecek berdasarkan kode pesanan.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Link href="/pesan/lacak" className="rounded-2xl border border-[#d8b77c] bg-white px-5 py-3 text-center font-black text-[#7a3f00] transition hover:bg-[#fff4d6]">Lacak pesanan lain</Link>
            <Link href="/pesan" className="rounded-2xl bg-[#8d4b00] px-5 py-3 text-center font-black text-white transition hover:bg-[#6f3900]">Buat pesanan lagi</Link>
          </div>
        </section>
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

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-[#2a1606] p-5 text-white">
      <p className="text-sm font-bold text-white/60">{label}</p>
      <p className="mt-2 break-words text-xl font-black">{value.replace(/_/g, ' ')}</p>
    </div>
  );
}

function formatTimelineEvent(value: string) {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function StatusShell({ title, message }: { title: string; message: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#fff8e7] p-6 text-[#231305]">
      <section className="max-w-lg rounded-3xl bg-white p-8 text-center shadow-xl">
        <h1 className="text-3xl font-black">{title}</h1>
        <p className="mt-3 text-[#6b4a2e]">{message}</p>
        <Link href="/pesan" className="mt-6 inline-block rounded-2xl bg-[#8d4b00] px-5 py-3 font-black text-white">Kembali pesan keripik</Link>
      </section>
    </main>
  );
}
