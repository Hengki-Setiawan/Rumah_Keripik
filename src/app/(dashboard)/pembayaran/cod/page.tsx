'use client';

import { useEffect, useState } from 'react';
import { formatRupiah } from '@/lib/utils';

type CodOrder = { id_transaksi: string; kode_pesanan: string | null; nama_penerima: string | null; no_hp_penerima: string | null; total_bayar: number; payment_status: string; order_status: string; waktu_simpan: string };

export default function CodOrdersPage() {
  const [orders, setOrders] = useState<CodOrder[]>([]);
  const [message, setMessage] = useState('');
  useEffect(() => { load(); }, []);
  async function load() { const res = await fetch('/api/admin/cod-orders'); const data = await res.json(); setOrders(data.orders || []); }
  async function decide(id: string, action: 'approve' | 'reject') {
    const confirmed = window.confirm(action === 'approve'
      ? 'Setujui COD ini? Stok akan dipotong dan order masuk proses.'
      : 'Tolak COD ini? Order akan dibatalkan.');
    if (!confirmed) return;

    const res = await fetch(`/api/admin/cod-orders/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
    const data = await res.json().catch(() => null);
    setMessage(res.ok && data?.ok ? `COD ${action === 'approve' ? 'disetujui' : 'ditolak'}` : data?.error || 'Gagal update COD');
    load();
  }
  return (
    <div className="space-y-6">
      <div><h1 className="font-headline-lg text-headline-lg text-on-surface">COD Control</h1><p className="text-on-surface-variant">Approve/reject order COD sebelum diproses.</p></div>
      {message && <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-700">{message}</p>}
      <div className="grid gap-4">
        {orders.map((order) => <section key={order.id_transaksi} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="font-black">{order.kode_pesanan || order.id_transaksi}</p><p className="text-sm text-on-surface-variant">{order.nama_penerima || '-'} - {order.no_hp_penerima || '-'}</p><p className="font-black text-primary">{formatRupiah(order.total_bayar)}</p><p className="text-sm text-on-surface-variant">{order.payment_status} / {order.order_status}</p></div><div className="flex gap-2"><button disabled={order.payment_status !== 'cod_requested'} onClick={() => decide(order.id_transaksi, 'approve')} className="rounded-xl bg-green-600 px-4 py-2 font-black text-white disabled:opacity-40">Approve</button><button disabled={order.payment_status !== 'cod_requested'} onClick={() => decide(order.id_transaksi, 'reject')} className="rounded-xl bg-red-600 px-4 py-2 font-black text-white disabled:opacity-40">Reject</button></div></div></section>)}
        {orders.length === 0 && <p className="rounded-2xl border bg-white p-6 text-center text-on-surface-variant">Belum ada order COD.</p>}
      </div>
    </div>
  );
}
