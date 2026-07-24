'use client';

interface ApprovalGateProps {
  total: number;
  itemCount: number;
  onConfirm: () => void;
  onEdit: () => void;
  loading?: boolean;
}

export function ApprovalGate({ total, itemCount, onConfirm, onEdit, loading }: ApprovalGateProps) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-semibold text-emerald-900">Ringkasan Pesanan</p>
          <p className="text-sm text-emerald-700">{itemCount} item</p>
        </div>
        <p className="text-lg font-bold text-emerald-900">
          Rp {total.toLocaleString('id-ID')}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onEdit}
          disabled={loading}
          className="flex-1 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
        >
          Ubah Pesanan
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? 'Memproses...' : 'Konfirmasi & Bayar'}
        </button>
      </div>
    </div>
  );
}
