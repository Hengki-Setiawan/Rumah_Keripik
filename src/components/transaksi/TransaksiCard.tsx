'use client';

import { User, Store, Smartphone, FileText, MapPin, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { formatRupiah } from '@/lib/utils';

interface TransaksiCardProps {
  tx: {
    id_transaksi: string;
    kode_pesanan?: string | null;
    nama_pelanggan?: string | null;
    nama_warung?: string | null;
    no_wa_pelanggan?: string | null;
    id_warung?: string | null;
    waktu_simpan: string;
    total_bayar: number;
    status_pembayaran: string;
    tipe_penjualan: string;
    lat_pengiriman?: string | null;
    lng_pengiriman?: string | null;
    nama_penerima?: string | null;
    alamat_penerima?: string | null;
  };
  onShowMap?: (txId: string) => void;
  isMapOpen?: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  Lunas: 'bg-green-100 text-green-700',
  Piutang: 'bg-red-100 text-red-700',
  Tidak_Lunas: 'bg-gray-100 text-gray-700',
  Menunggu_Bayar: 'bg-yellow-100 text-yellow-700',
  Menunggu_Verifikasi: 'bg-orange-100 text-orange-700',
  Dibatalkan: 'bg-red-50 text-red-400',
};

export function TransaksiCard({ tx, onShowMap, isMapOpen }: TransaksiCardProps) {
  const [expanded, setExpanded] = useState(false);

  function formatDate(ts: string) {
    return new Date(ts + 'Z').toLocaleString('id-ID', {
      timeZone: 'Asia/Makassar',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const hasLocation = !!(tx.lat_pengiriman && tx.lng_pengiriman);

  return (
    <div className="bg-surface-container-lowest border border-neutral-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Top Row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-bold text-primary truncate">#{tx.id_transaksi}</p>
          {tx.kode_pesanan && (
            <p className="text-[10px] text-on-surface-variant/65 uppercase tracking-wide">
              {tx.kode_pesanan}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              STATUS_STYLES[tx.status_pembayaran] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {tx.status_pembayaran.replace(/_/g, ' ')}
          </span>
          <span
            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold ${
              tx.tipe_penjualan === 'Online_WA'
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-orange-100 text-orange-700'
            }`}
          >
            {tx.tipe_penjualan === 'Online_WA' ? (
              <Smartphone size={9} />
            ) : (
              <FileText size={9} />
            )}
            {tx.tipe_penjualan === 'Online_WA' ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Pelanggan */}
      <div className="flex items-center gap-2 mb-2">
        {tx.nama_pelanggan ? (
          <>
            <User size={14} className="text-green-600 shrink-0" />
            <span className="text-sm font-semibold text-on-surface">{tx.nama_pelanggan}</span>
          </>
        ) : tx.nama_warung ? (
          <>
            <Store size={14} className="text-purple-600 shrink-0" />
            <span className="text-sm font-semibold text-purple-900">{tx.nama_warung}</span>
          </>
        ) : (
          <span className="text-sm text-outline/50 italic">Walk-in Customer</span>
        )}
      </div>

      {/* Waktu & Total */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-on-surface-variant">
          <Clock size={11} />
          <span>{formatDate(tx.waktu_simpan)}</span>
        </div>
        <span className="font-bold text-sm text-on-surface">{formatRupiah(tx.total_bayar)}</span>
      </div>

      {/* Expanded: alamat penerima */}
      {expanded && tx.nama_penerima && (
        <div className="mt-3 pt-3 border-t border-outline-variant/10 text-sm space-y-1">
          <p className="text-on-surface-variant">
            <span className="font-semibold text-on-surface">Penerima:</span> {tx.nama_penerima}
          </p>
          {tx.alamat_penerima && (
            <p className="text-on-surface-variant flex items-start gap-1">
              <MapPin size={13} className="mt-0.5 shrink-0" />
              {tx.alamat_penerima}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-outline-variant/5">
        {(tx.nama_penerima || tx.alamat_penerima) && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary transition-colors"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'Sembunyikan' : 'Detail Pengiriman'}
          </button>
        )}
        {hasLocation && onShowMap && (
          <button
            onClick={() => onShowMap(tx.id_transaksi)}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors ml-auto ${
              isMapOpen
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:text-primary hover:bg-surface-container'
            }`}
          >
            <MapPin size={13} />
            {isMapOpen ? 'Tutup Peta' : 'Lihat Peta'}
          </button>
        )}
      </div>
    </div>
  );
}
