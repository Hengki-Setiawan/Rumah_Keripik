'use client';

import { Filter, Smartphone, FileText, X } from 'lucide-react';

export type TypeFilter = 'all' | 'Online_WA' | 'Offline_Gudang';
export type PaymentFilter = 'all' | 'Lunas' | 'Piutang' | 'Tidak_Lunas' | 'Menunggu_Verifikasi' | 'Menunggu_Bayar' | 'Dibatalkan';

interface TransaksiFilterProps {
  typeFilter: TypeFilter;
  paymentFilter: PaymentFilter;
  onTypeChange: (val: TypeFilter) => void;
  onPaymentChange: (val: PaymentFilter) => void;
  onReset?: () => void;
  resultCount?: number;
}

const TYPE_OPTIONS: { value: TypeFilter; label: string; icon?: React.ReactNode }[] = [
  { value: 'all', label: 'Semua Tipe' },
  { value: 'Online_WA', label: 'Online (WA)', icon: <Smartphone size={12} /> },
  { value: 'Offline_Gudang', label: 'Offline (Gudang)', icon: <FileText size={12} /> },
];

const PAYMENT_OPTIONS: { value: PaymentFilter; label: string; color: string }[] = [
  { value: 'all', label: 'Semua Status', color: '' },
  { value: 'Lunas', label: 'Lunas', color: 'text-green-700' },
  { value: 'Menunggu_Verifikasi', label: 'Menunggu Verif', color: 'text-orange-700' },
  { value: 'Menunggu_Bayar', label: 'Menunggu Bayar', color: 'text-yellow-700' },
  { value: 'Piutang', label: 'Piutang', color: 'text-red-700' },
  { value: 'Tidak_Lunas', label: 'Tidak Lunas', color: 'text-gray-700' },
  { value: 'Dibatalkan', label: 'Dibatalkan', color: 'text-red-400' },
];

export function TransaksiFilter({
  typeFilter,
  paymentFilter,
  onTypeChange,
  onPaymentChange,
  onReset,
  resultCount,
}: TransaksiFilterProps) {
  const isFiltered = typeFilter !== 'all' || paymentFilter !== 'all';

  return (
    <div className="flex flex-wrap items-center gap-3 bg-surface-container-lowest border border-neutral-200 p-4 rounded-xl">
      {/* Icon */}
      <div className="flex items-center gap-1.5 text-on-surface-variant">
        <Filter size={15} />
        <span className="font-label-md text-label-md text-sm">Filter</span>
      </div>

      {/* Tipe Penjualan */}
      <div className="flex gap-1 bg-surface-container rounded-lg p-0.5">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onTypeChange(opt.value)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-label-md transition-colors whitespace-nowrap ${
              typeFilter === opt.value
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>

      {/* Status Pembayaran */}
      <select
        value={paymentFilter}
        onChange={(e) => onPaymentChange(e.target.value as PaymentFilter)}
        className="px-3 py-1.5 border border-outline-variant rounded-lg text-sm bg-surface-container-lowest focus:ring-primary focus:border-primary focus:outline-none font-body-md"
      >
        {PAYMENT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Result count + reset */}
      <div className="flex items-center gap-2 ml-auto">
        {resultCount !== undefined && (
          <span className="text-xs text-on-surface-variant">
            {resultCount} transaksi
          </span>
        )}
        {isFiltered && onReset && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-error transition-colors"
          >
            <X size={13} />
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
