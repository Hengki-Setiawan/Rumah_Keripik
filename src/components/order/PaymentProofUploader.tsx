'use client';

import { useState } from 'react';
import { UploadCloud } from 'lucide-react';

type Props = {
  orderId: string;
  statusToken: string;
};

export function PaymentProofUploader({ orderId, statusToken }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [amountClaimed, setAmountClaimed] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function upload() {
    if (!file) {
      setMessage('Pilih screenshot bukti pembayaran dulu.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('Format harus JPG, PNG, atau WEBP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('Ukuran file maksimal 5 MB.');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const signRes = await fetch('/api/public/payment-proof/sign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, statusToken }),
      });
      const sign = await signRes.json();
      if (!signRes.ok || !sign.ok) throw new Error(sign.error || 'Gagal membuat signature upload');

      const form = new FormData();
      form.append('file', file);
      form.append('api_key', sign.apiKey);
      form.append('timestamp', String(sign.timestamp));
      form.append('signature', sign.signature);
      form.append('folder', sign.folder);
      form.append('public_id', sign.publicId);

      const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`, {
        method: 'POST',
        body: form,
      });
      const cloud = await cloudRes.json();
      if (!cloudRes.ok) throw new Error(cloud.error?.message || 'Upload bukti pembayaran gagal');

      const completeRes = await fetch('/api/public/payment-proof/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          statusToken,
          cloudinaryPublicId: cloud.public_id,
          secureUrl: cloud.secure_url,
          originalFilename: file.name,
          fileFormat: cloud.format || file.type.replace('image/', '').replace('jpeg', 'jpg'),
          fileSizeBytes: file.size,
          amountClaimed: amountClaimed ? Number(amountClaimed) : undefined,
        }),
      });
      const complete = await completeRes.json();
      if (!completeRes.ok || !complete.ok) throw new Error(complete.error || 'Gagal menyimpan bukti pembayaran');

      setFile(null);
      setAmountClaimed('');
       setMessage('Bukti pembayaran berhasil diupload. Admin akan cek dan memperbarui status pesanan.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload gagal');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 rounded-[1.5rem] border border-[#e0bd82] bg-[#fff8e8] p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#8d4b00] text-white">
          <UploadCloud size={22} />
        </div>
        <div>
          <p className="font-black">Upload bukti pembayaran</p>
          <p className="text-sm text-[#735033]">JPG, PNG, atau WEBP maksimal 5 MB. Pastikan nominal terlihat jelas.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px]">
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} className="rounded-xl border border-[#d8b77c] bg-white px-3 py-3" />
        <input value={amountClaimed} onChange={(event) => setAmountClaimed(event.target.value)} inputMode="numeric" placeholder="Nominal bayar" className="rounded-xl border border-[#d8b77c] bg-white px-3 py-3" />
      </div>
      {message && <p className="mt-3 text-sm font-bold text-[#7a3f00]">{message}</p>}
      <button onClick={upload} disabled={loading} className="mt-4 rounded-2xl bg-[#1f7a3d] px-5 py-3 font-black text-white transition hover:bg-[#176033] disabled:opacity-60">
        {loading ? 'Mengupload...' : 'Upload Bukti'}
      </button>
    </div>
  );
}
