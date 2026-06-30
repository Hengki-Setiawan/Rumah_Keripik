'use client';

import { useState } from 'react';
import { ZoomIn, ZoomOut, X, ExternalLink, ImageOff } from 'lucide-react';

interface BuktiPembayaranProps {
  url: string;
  kode_pesanan?: string;
  nama?: string;
  onClose?: () => void;
}

export function BuktiPembayaran({ url, kode_pesanan, nama, onClose }: BuktiPembayaranProps) {
  const [zoomed, setZoomed] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-label-md text-label-md text-on-surface font-bold">
            📸 Bukti Pembayaran
          </p>
          {kode_pesanan && (
            <p className="text-xs text-on-surface-variant font-mono">{kode_pesanan}</p>
          )}
          {nama && (
            <p className="text-xs text-on-surface-variant">dari {nama}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!imgError && (
            <>
              <button
                onClick={() => setZoomed((z) => !z)}
                className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
                title={zoomed ? 'Perkecil' : 'Perbesar'}
              >
                {zoomed ? <ZoomOut size={16} /> : <ZoomIn size={16} />}
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
                title="Buka di tab baru"
              >
                <ExternalLink size={16} />
              </a>
            </>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Image */}
      <div
        className={`relative overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container transition-all duration-300 ${
          zoomed ? 'max-h-[70vh]' : 'max-h-80'
        }`}
      >
        {imgError ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-on-surface-variant">
            <ImageOff size={40} className="text-outline-variant" />
            <p className="text-sm text-center">
              Gambar tidak dapat ditampilkan.{' '}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:opacity-80"
              >
                Buka langsung
              </a>
            </p>
          </div>
        ) : (
          <img
            src={url}
            alt="Bukti Pembayaran"
            className={`w-full object-contain transition-all duration-300 ${
              zoomed ? 'max-h-[70vh]' : 'max-h-80'
            }`}
            onError={() => setImgError(true)}
          />
        )}
      </div>

      {/* Info */}
      <p className="text-xs text-on-surface-variant text-center">
        Klik 🔍 untuk zoom · Klik ↗ untuk buka di tab baru
      </p>
    </div>
  );
}
