'use client';

import { useState } from 'react';

type Props = {
  folder: 'rumah-keripik/products' | 'rumah-keripik/products/variants' | 'rumah-keripik/qris';
  value?: string;
  onUploaded: (secureUrl: string, publicId: string) => void;
};

export function CloudinaryImageUpload({ folder, value, onUploaded }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function upload(file: File | null) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('Format harus JPG, PNG, atau WEBP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('Ukuran maksimal 5 MB');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const signRes = await fetch('/api/admin/cloudinary/sign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder, publicId: `${folder.split('/').pop()}-${Date.now()}` }),
      });
      const sign = await signRes.json();
      if (!signRes.ok || !sign.ok) throw new Error(sign.error || 'Gagal membuat signature upload');
      const form = new FormData();
      form.append('file', file);
      form.append('api_key', sign.apiKey);
      form.append('timestamp', String(sign.timestamp));
      form.append('signature', sign.signature);
      form.append('folder', sign.folder);
      if (sign.publicId) form.append('public_id', sign.publicId);
      const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`, { method: 'POST', body: form });
      const cloud = await cloudRes.json();
      if (!cloudRes.ok) throw new Error(cloud.error?.message || 'Upload Cloudinary gagal');
      onUploaded(cloud.secure_url, cloud.public_id);
      setMessage('Upload berhasil');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload gagal');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => upload(event.target.files?.[0] || null)} className="w-full rounded-xl border px-3 py-2" />
      {loading && <p className="text-xs font-bold text-on-surface-variant">Mengupload...</p>}
      {message && <p className="text-xs font-bold text-amber-700">{message}</p>}
      {value && <img src={value} alt="Preview upload" className="max-h-40 rounded-xl border object-contain" />}
    </div>
  );
}
