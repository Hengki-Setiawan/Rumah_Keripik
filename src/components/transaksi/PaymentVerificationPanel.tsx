'use client';

import { useEffect, useState } from 'react';
import { Eye, FileText, PackageCheck, RefreshCw } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';
import { InfoButton } from '@/components/ui/InfoButton';

type ProofRow = {
  proof: { id_payment_proof: string; secure_url: string; status: 'pending' | 'accepted' | 'rejected'; amount_claimed: number | null; uploaded_at: string; admin_note: string | null };
  order: { id_transaksi: string; kode_pesanan: string | null; total_bayar: number; nama_penerima: string | null; payment_status: string; order_status: string } | null;
  verification: { score: number; warnings: string[]; level: 'safe' | 'warning' | 'danger' };
};

type OcrJob = { id: number; status: string; priority: number; result_json: string | null; error_message: string | null; created_at: string };
type AgingOrder = { id_transaksi: string; kode_pesanan: string | null; nama_penerima: string | null; total_bayar: number; payment_status: string; ageHours: number; reminderDue: boolean };

export function PaymentVerificationPanel({ compactHeader = false }: { compactHeader?: boolean }) {
  const [rows, setRows] = useState<ProofRow[]>([]);
  const [ocrJobs, setOcrJobs] = useState<OcrJob[]>([]);
  const [agingOrders, setAgingOrders] = useState<AgingOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | 'safe' | 'warning' | 'danger' | 'duplicate'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchProofs().catch(() => setMessage('Gagal memuat bukti pembayaran'));
  }, []);

  async function fetchProofs() {
    setLoading(true);
    const res = await fetch('/api/admin/payment-proofs');
    const data = await res.json();
    setRows(data.proofs || []);
    const jobsRes = await fetch('/api/admin/payment-proof-ocr-jobs');
    const jobsData = await jobsRes.json().catch(() => null);
    if (jobsData?.ok) setOcrJobs(jobsData.jobs || []);
    const agingRes = await fetch('/api/admin/payment-aging');
    const agingData = await agingRes.json().catch(() => null);
    if (agingData?.ok) setAgingOrders(agingData.orders || []);
    setLoading(false);
  }

  async function queueReminders() {
    const res = await fetch('/api/admin/payment-aging', { method: 'POST' });
    const data = await res.json().catch(() => null);
    setMessage(data?.ok ? `${data.queued} reminder pembayaran masuk queue` : 'Gagal queue reminder');
    fetchProofs();
  }

  function parseOcrResult(value: string | null) {
    if (!value) return null;
    try {
      return JSON.parse(value) as { engine?: string; score?: number; summary?: string; extractedAmount?: number | null; reference?: string | null; statusKeywords?: string[] };
    } catch {
      return null;
    }
  }

  const filteredRows = rows.filter((row) => {
    if (statusFilter !== 'all' && row.proof.status !== statusFilter) return false;
    if (riskFilter !== 'all') {
      if (riskFilter === 'duplicate') {
        if (!row.verification.warnings.some((warning) => warning.toLowerCase().includes('duplikat') || warning.toLowerCase().includes('bukti pembayaran'))) return false;
      } else if (row.verification.level !== riskFilter) return false;
    }
    const query = search.trim().toLowerCase();
    if (!query) return true;
    const haystack = `${row.order?.kode_pesanan || ''} ${row.order?.id_transaksi || ''} ${row.order?.nama_penerima || ''} ${row.proof.id_payment_proof}`.toLowerCase();
    return haystack.includes(query);
  });

  return (
    <div className="space-y-4">
      <div className={`${compactHeader ? 'rounded-2xl border border-outline-variant bg-white p-4' : ''} flex flex-col gap-3 md:flex-row md:items-start md:justify-between`}>
        <div>
          <h2 className={compactHeader ? 'text-lg font-semibold tracking-[-0.02em] text-on-surface' : 'font-headline-lg text-headline-lg text-on-surface'}>{compactHeader ? 'Bukti Bayar & Aging' : 'Verifikasi Pembayaran'}</h2>
          <p className="text-sm text-on-surface-variant">Lihat bukti transfer/QRIS, OCR assist, payment aging, lalu approve atau reject manual.</p>
        </div>
        <div className="flex gap-2">
          <InfoButton title="Verifikasi Pembayaran" description="Pusat validasi bukti bayar pelanggan. Sistem memberi skor bantu, daftar warning, OCR queue, dan reminder aging, tetapi keputusan akhir tetap admin." usage="Cari order, cek gambar asli, perhatikan skor dan warning, buka Detail untuk approve/reject. Gunakan Payment Aging untuk reminder order yang lama belum dibayar." />
          <button onClick={() => fetchProofs()} className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2 text-sm font-medium text-on-surface transition hover:bg-surface-container"><RefreshCw size={16} /> Refresh</button>
        </div>
      </div>

      {message && <p className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-sm font-medium text-on-surface-variant">{message}</p>}
      {loading ? <p>Memuat...</p> : (
        <div className="grid gap-4">
          <section className="rounded-2xl border border-outline-variant bg-white p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari kode/order/penerima/bukti" className="rounded-xl border border-outline-variant px-3 py-2 text-sm outline-none focus:border-primary/40" />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-xl border border-outline-variant px-3 py-2 text-sm font-medium outline-none focus:border-primary/40"><option value="all">Semua status</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option></select>
              <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as typeof riskFilter)} className="rounded-xl border border-outline-variant px-3 py-2 text-sm font-medium outline-none focus:border-primary/40"><option value="all">Semua risiko</option><option value="safe">Safe</option><option value="warning">Warning</option><option value="danger">Danger</option><option value="duplicate">Duplikat/Reupload</option></select>
            </div>
            <div className="mt-3 grid gap-2 text-sm md:grid-cols-4"><Summary label="Total" value={rows.length} /><Summary label="Pending" value={rows.filter((row) => row.proof.status === 'pending').length} /><Summary label="Danger" value={rows.filter((row) => row.verification.level === 'danger').length} /><Summary label="Tampil" value={filteredRows.length} /></div>
          </section>

          {agingOrders.length > 0 && <section className="rounded-2xl border border-outline-variant bg-white p-4"><div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><h2 className="text-lg font-semibold tracking-[-0.02em]">Payment Aging</h2><p className="text-sm text-on-surface-variant">Order yang masih menunggu pembayaran/verifikasi. Reminder due setelah 24 jam.</p></div><button onClick={queueReminders} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary transition hover:opacity-90">Tandai Reminder 24 Jam</button></div><div className="grid gap-2 md:grid-cols-3">{agingOrders.slice(0, 6).map((order) => <div key={order.id_transaksi} className={`rounded-xl border border-outline-variant p-3 text-sm ${order.reminderDue ? 'bg-secondary-container/50' : 'bg-surface-container-low'}`}><p className="font-semibold">{order.kode_pesanan || order.id_transaksi}</p><p className="text-xs text-on-surface-variant">{order.nama_penerima || '-'}</p><p className="mt-2 font-semibold">{formatRupiah(order.total_bayar)}</p><p className="text-xs text-on-surface-variant">Status: {order.payment_status}</p><p className="text-xs text-on-surface-variant">Umur: {order.ageHours} jam</p></div>)}</div></section>}

          {ocrJobs.length > 0 && <section className="rounded-2xl border border-outline-variant bg-white p-4"><div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between"><div><h2 className="text-lg font-semibold tracking-[-0.02em]">OCR Assist Queue</h2><p className="text-sm text-on-surface-variant">Rule-based precheck untuk membantu admin membaca bukti bayar. Tidak ada auto-approve.</p></div><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium">{ocrJobs.length} job terbaru</span></div><div className="grid gap-2 md:grid-cols-3">{ocrJobs.slice(0, 6).map((job) => { const result = parseOcrResult(job.result_json); return <div key={job.id} className="rounded-xl border border-outline-variant bg-surface-container-low p-3 text-sm"><div className="flex items-center justify-between gap-2"><span className="font-semibold">Job #{job.id}</span><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium">{job.status}</span></div><p className="mt-2 text-xs text-on-surface-variant">Priority {job.priority} - {new Date(job.created_at).toLocaleString('id-ID')}</p>{result?.score != null && <p className="mt-2 font-semibold">Skor: {result.score}/100</p>}{result?.engine && <p className="mt-1 text-xs text-on-surface-variant">Engine: {result.engine}</p>}{result?.extractedAmount != null && <p className="mt-1 text-xs text-on-surface-variant">Nominal terbaca: {formatRupiah(result.extractedAmount)}</p>}{result?.reference && <p className="mt-1 text-xs text-on-surface-variant">Ref: {result.reference}</p>}{result?.statusKeywords && result.statusKeywords.length > 0 && <p className="mt-1 text-xs text-on-surface-variant">Keyword: {result.statusKeywords.join(', ')}</p>}{result?.summary && <p className="mt-1 text-xs text-on-surface-variant">{result.summary}</p>}{job.error_message && <p className="mt-1 text-xs text-red-600">{job.error_message}</p>}</div>; })}</div></section>}

          {filteredRows.map((row) => <div key={row.proof.id_payment_proof} className="grid gap-4 rounded-2xl border border-outline-variant bg-white p-4 md:grid-cols-[180px_1fr_auto]"><a href={row.proof.secure_url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border bg-neutral-50"><img src={row.proof.secure_url} alt="Bukti pembayaran" className="h-44 w-full object-cover" /></a><div className="space-y-2"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-on-surface-variant">{row.proof.status}</span><span className="text-sm text-on-surface-variant">{new Date(row.proof.uploaded_at).toLocaleString('id-ID')}</span></div><h2 className="text-xl font-semibold tracking-[-0.02em]">{row.order?.kode_pesanan || row.order?.id_transaksi || 'Order tidak ditemukan'}</h2><p className="text-sm text-on-surface-variant">Penerima: {row.order?.nama_penerima || '-'}</p><p className="font-semibold">Total order: {formatRupiah(row.order?.total_bayar || 0)}</p>{row.proof.amount_claimed != null && <p className="text-sm">Nominal klaim: {formatRupiah(row.proof.amount_claimed)}</p>}<div className={`rounded-xl border p-3 text-sm ${row.verification.level === 'safe' ? 'border-green-100 bg-green-50/70 text-green-800' : row.verification.level === 'warning' ? 'border-orange-100 bg-orange-50/70 text-orange-800' : 'border-red-100 bg-red-50/70 text-red-800'}`}><p className="font-semibold">Skor bantu verifikasi: {row.verification.score}/100</p><p className="mt-1 text-xs">Skor ini hanya bantuan rule-based. Admin tetap wajib cek bukti asli.</p>{row.verification.warnings.length > 0 && <ul className="mt-2 list-disc pl-4 text-xs">{row.verification.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}</div>{row.proof.admin_note && <p className="text-sm text-on-surface-variant">Catatan: {row.proof.admin_note}</p>}{row.order && <div className="flex flex-wrap gap-2 pt-2"><a href={`/dokumen/order/${encodeURIComponent(row.order.id_transaksi)}/proforma`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"><FileText size={14} /> Proforma</a><a href={`/dokumen/order/${encodeURIComponent(row.order.id_transaksi)}/receipt`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"><FileText size={14} /> Receipt</a><a href={`/dokumen/order/${encodeURIComponent(row.order.id_transaksi)}/packing-label`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"><PackageCheck size={14} /> Packing Label</a></div>}</div><div className="flex gap-2 md:flex-col"><a href={`/pembayaran/verifikasi/${encodeURIComponent(row.proof.id_payment_proof)}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary"><Eye size={16} /> Detail</a></div></div>)}
          {filteredRows.length === 0 && <p className="rounded-2xl border bg-white p-6 text-center text-on-surface-variant">Tidak ada bukti pembayaran sesuai filter.</p>}
        </div>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-neutral-50 p-3"><p className="text-xs font-medium text-on-surface-variant">{label}</p><p className="text-2xl font-semibold tracking-[-0.03em] text-primary">{value}</p></div>;
}
