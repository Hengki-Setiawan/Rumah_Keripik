'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Eye, EyeOff, MapPin, Loader } from 'lucide-react';
import { BuktiPembayaran } from './BuktiPembayaran';

interface PesananMenunggu {
  id_transaksi: string;
  kode_pesanan: string;
  no_wa_pelanggan: string;
  nama_penerima: string | null;
  alamat_penerima: string | null;
  lat_pengiriman: number | null;
  lng_pengiriman: number | null;
  total_bayar: number;
  waktu_simpan: string;
  channel: string;
  bukti_url: string | null;
  nama_pelanggan: string | null;
  items: { nama: string; qty: number; subtotal: number }[];
}

export function VerifikasiAntrian() {
  const [pesanan, setPesanan] = useState<PesananMenunggu[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBukti, setShowBukti] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchAntrian = async () => {
    try {
      const res = await fetch('/api/admin/pending-payments');
      if (res.ok) {
        const data = await res.json();
        setPesanan(data.pesanan || []);
      }
    } catch (err) {
      console.error('[Verifikasi] Fetch error:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAntrian();
    const interval = setInterval(fetchAntrian, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleVerify = async (id_transaksi: string, action: 'approve' | 'reject') => {
    setProcessing(id_transaksi);
    try {
      const res = await fetch('/api/admin/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_transaksi, action }),
      });
      if (res.ok) {
        await fetchAntrian();
      } else {
        const err = await res.json();
        console.error('[Verifikasi] Error:', err);
      }
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-surface-container rounded-xl" />
        ))}
      </div>
    );
  }

  if (pesanan.length === 0) {
    return (
      <div className="text-center py-12 text-on-surface-variant">
        <CheckCircle size={48} className="mx-auto mb-3 text-green-400" />
        <p className="font-medium">Semua pembayaran sudah diverifikasi! ✅</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
        <span className="text-sm font-medium text-on-surface-variant">
          {pesanan.length} pesanan menunggu verifikasi
        </span>
      </div>

      {pesanan.map((p) => (
        <div
          key={p.id_transaksi}
          className="border border-neutral-200 rounded-xl p-4 bg-surface-container-lowest hover:border-primary/30 transition-colors"
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-primary">
                  #{p.kode_pesanan || p.id_transaksi}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                  WhatsApp
                </span>
              </div>
              <p className="text-on-surface-variant text-xs mt-0.5">
                {formatWaktu(p.waktu_simpan)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg">
                Rp {p.total_bayar.toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          <div className="bg-surface-container/50 rounded-lg p-3 mb-3 text-sm space-y-1">
            {p.items.map((item, i) => (
              <div key={i} className="flex justify-between">
                <span>{item.nama} × {item.qty}</span>
                <span className="font-medium">Rp {item.subtotal.toLocaleString('id-ID')}</span>
              </div>
            ))}
          </div>

          {p.nama_penerima && (
            <div className="text-sm mb-3 space-y-1">
              <p className="flex items-center gap-1">
                <span className="font-medium">{p.nama_penerima}</span>
              </p>
              {p.alamat_penerima && (
                <p className="flex items-start gap-1 text-on-surface-variant">
                  <MapPin size={14} className="shrink-0 mt-0.5" />
                  <span>
                    {p.alamat_penerima.length > 60
                      ? p.alamat_penerima.slice(0, 60) + '...'
                      : p.alamat_penerima}
                  </span>
                </p>
              )}
            </div>
          )}

          {showBukti === p.id_transaksi && p.bukti_url && (
            <div className="mb-3 p-4 rounded-lg bg-surface-container border">
              <BuktiPembayaran 
                url={p.bukti_url} 
                kode_pesanan={p.kode_pesanan} 
                nama={p.nama_penerima || p.nama_pelanggan || undefined} 
                onClose={() => setShowBukti(null)}
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {p.bukti_url && (
              <button
                onClick={() => setShowBukti(showBukti === p.id_transaksi ? null : p.id_transaksi)}
                className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-surface-container transition-colors"
              >
                {showBukti === p.id_transaksi ? <EyeOff size={16} /> : <Eye size={16} />}
                {showBukti === p.id_transaksi ? 'Tutup Preview' : 'Lihat Bukti'}
              </button>
            )}

            <button
              onClick={() => handleVerify(p.id_transaksi, 'approve')}
              disabled={processing === p.id_transaksi}
              className="flex items-center gap-1 text-sm px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-50 transition-colors"
            >
              {processing === p.id_transaksi ? (
                <Loader size={16} className="animate-spin" />
              ) : (
                <CheckCircle size={16} />
              )}
              Verifikasi Lunas
            </button>

            <button
              onClick={() => handleVerify(p.id_transaksi, 'reject')}
              disabled={processing === p.id_transaksi}
              className="flex items-center gap-1 text-sm px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50 transition-colors"
            >
              <XCircle size={16} />
              Tolak
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatWaktu(ts: string) {
  try {
    const d = new Date(ts + 'Z');
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}
