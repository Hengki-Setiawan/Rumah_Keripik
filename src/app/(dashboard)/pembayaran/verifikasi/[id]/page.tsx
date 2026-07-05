'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { PAYMENT_REJECT_REASONS } from '@/lib/validators/payment';
import { formatRupiah } from '@/lib/utils';

type PageProps = { params: Promise<{ id: string }> };

type DetailData = {
  proof: { id_payment_proof: string; secure_url: string; status: string; amount_claimed: number | null; uploaded_at: string; admin_note: string | null };
  order: { id_transaksi: string; kode_pesanan: string | null; total_bayar: number; nama_penerima: string | null; payment_status: string; order_status: string } | null;
  items: { id: number; nama_produk_snapshot: string | null; nama_varian_snapshot: string | null; qty_terjual: number; subtotal: number }[];
  verification: { score: number; warnings: string[]; level: 'safe' | 'warning' | 'danger' };
  duplicateSignals: { type: string; severity: 'warning' | 'danger'; message: string }[];
  ocrResult: { engine: string; extracted_amount: number | null; reference_number: string | null; status_keywords_json: string; score: number; warnings_json: string; summary: string | null; raw_json: string | null } | null;
  ocrJob: { status: string; result_json: string | null; error_message: string | null; updated_at: string } | null;
};

export default function PaymentProofDetailPage({ params }: PageProps) {
  const [id, setId] = useState('');
  const [data, setData] = useState<DetailData | null>(null);
  const [note, setNote] = useState('');
  const [reasonCode, setReasonCode] = useState<(typeof PAYMENT_REJECT_REASONS)[number]>('amount_mismatch');
  const [message, setMessage] = useState('');

  useEffect(() => {
    params.then(({ id }) => {
      setId(id);
      fetch(`/api/admin/payment-proofs/${encodeURIComponent(id)}`).then((res) => res.json()).then((json) => {
        if (json.ok) setData(json);
        else setMessage(json.error || 'Gagal memuat detail');
      });
    });
  }, [params]);

  async function decide(action: 'approve' | 'reject') {
    const res = await fetch(`/api/admin/payment-proofs/${encodeURIComponent(id)}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action === 'reject' ? { reasonCode, note } : { note }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      setMessage(json?.error || 'Gagal update status');
      return;
    }
    setMessage(action === 'approve' ? 'Pembayaran disetujui' : 'Pembayaran ditolak');
  }

  if (!data) return <p className="p-6">{message || 'Memuat...'}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black">Detail Bukti Pembayaran</h1>
          <p className="text-on-surface-variant">Admin wajib cek detail sebelum approve/reject.</p>
        </div>
        <Link href="/pembayaran/verifikasi" className="rounded-xl border px-4 py-2 font-bold">Kembali</Link>
      </div>
      {message && <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-700">{message}</p>}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <a href={data.proof.secure_url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border bg-white p-3 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.proof.secure_url} alt="Bukti pembayaran" className="max-h-[620px] w-full rounded-xl object-contain" />
        </a>
        <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm text-on-surface-variant">Order</p>
            <h2 className="text-2xl font-black">{data.order?.kode_pesanan || data.order?.id_transaksi || '-'}</h2>
            <p className="mt-1 text-sm">Penerima: {data.order?.nama_penerima || '-'}</p>
            <p className="font-black">Total: {formatRupiah(data.order?.total_bayar || 0)}</p>
            {data.proof.amount_claimed != null && <p className="text-sm">Nominal klaim: {formatRupiah(data.proof.amount_claimed)}</p>}
          </div>

          <div className={`rounded-xl p-4 ${data.verification.level === 'safe' ? 'bg-green-50 text-green-800' : data.verification.level === 'warning' ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-800'}`}>
            <p className="font-black">Skor bantu: {data.verification.score}/100</p>
            {data.verification.warnings.length > 0 && <p className="mt-1 text-sm">{data.verification.warnings.join(', ')}</p>}
          </div>
          {data.duplicateSignals.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-black">Sinyal Duplikat/Reupload</p>
              <div className="mt-2 space-y-1">
                {data.duplicateSignals.map((signal) => <p key={`${signal.type}-${signal.message}`}>[{signal.severity}] {signal.message}</p>)}
              </div>
            </div>
          )}

          <div className="rounded-xl border p-4">
            <p className="font-black">OCR Assist</p>
            {!data.ocrJob && <p className="mt-1 text-sm text-on-surface-variant">Job OCR belum ditemukan untuk bukti ini.</p>}
            {data.ocrJob && (
              <div className="mt-2 space-y-2 text-sm">
                <p>Status job: <b>{data.ocrJob.status}</b></p>
                {data.ocrJob.error_message && <p className="rounded-lg bg-red-50 p-2 font-bold text-red-700">{data.ocrJob.error_message}</p>}
                {data.ocrJob.result_json && <OcrSummary raw={data.ocrJob.result_json} />}
              </div>
            )}
            {data.ocrResult && <PersistedOcrSummary result={data.ocrResult} />}
          </div>

          <div className="rounded-xl border p-4">
            <p className="font-black">Item</p>
            <div className="mt-2 space-y-2">
              {data.items.map((item) => <div key={item.id} className="flex justify-between gap-4 text-sm"><span>{item.nama_produk_snapshot || '-'} {item.nama_varian_snapshot || ''} x{item.qty_terjual}</span><b>{formatRupiah(item.subtotal)}</b></div>)}
            </div>
          </div>

          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Catatan admin" className="min-h-24 w-full rounded-xl border p-3" />
          <select value={reasonCode} onChange={(event) => setReasonCode(event.target.value as typeof reasonCode)} className="w-full rounded-xl border p-3">
            {PAYMENT_REJECT_REASONS.map((reason) => <option key={reason} value={reason}>{reason.replace(/_/g, ' ')}</option>)}
          </select>
          <div className="grid gap-3 md:grid-cols-2">
            <button disabled={data.proof.status !== 'pending'} onClick={() => decide('approve')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 font-black text-white disabled:opacity-40"><CheckCircle size={18} /> Approve</button>
            <button disabled={data.proof.status !== 'pending'} onClick={() => decide('reject')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-black text-white disabled:opacity-40"><XCircle size={18} /> Reject</button>
          </div>
        </section>
      </div>
    </div>
  );
}

function PersistedOcrSummary({ result }: { result: NonNullable<DetailData['ocrResult']> }) {
  const warnings = parseArray(result.warnings_json);
  const keywords = parseArray(result.status_keywords_json);
  return (
    <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
      <p className="font-black">OCR tersimpan: {result.engine}</p>
      {result.summary && <p className="mt-1">{result.summary}</p>}
      {result.extracted_amount != null && <p>Nominal OCR: <b>{formatRupiah(result.extracted_amount)}</b></p>}
      {result.reference_number && <p>Referensi: <b>{result.reference_number}</b></p>}
      {keywords.length > 0 && <p>Keyword: {keywords.join(', ')}</p>}
      <p>Skor: <b>{result.score}/100</b></p>
      {warnings.length > 0 && <p className="text-amber-800">Peringatan: {warnings.join(', ')}</p>}
    </div>
  );
}

function parseArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function OcrSummary({ raw }: { raw: string }) {
  let parsed: any = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return <pre className="max-h-40 overflow-auto rounded-lg bg-neutral-100 p-2 text-xs">{raw}</pre>;
  }

  return (
    <div className="rounded-lg bg-neutral-50 p-3">
      <p>{parsed.summary || 'OCR selesai tanpa ringkasan.'}</p>
      {parsed.extractedAmount != null && <p className="mt-1">Nominal terbaca: <b>{formatRupiah(parsed.extractedAmount)}</b></p>}
      {typeof parsed.score === 'number' && <p>Skor OCR: <b>{parsed.score}/100</b></p>}
      {Array.isArray(parsed.warnings) && parsed.warnings.length > 0 && <p className="text-amber-700">Peringatan: {parsed.warnings.join(', ')}</p>}
      <p className="mt-2 text-xs text-on-surface-variant">OCR hanya alat bantu. Admin tetap wajib cek bukti manual.</p>
    </div>
  );
}
