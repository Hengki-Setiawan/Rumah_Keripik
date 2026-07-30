'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Truck, Package, CreditCard, XCircle, AlertCircle } from 'lucide-react';

type TimelineEvent = {
  id: number;
  id_transaksi: string;
  order_status: string | null;
  payment_status: string | null;
  event_type: string;
  note: string | null;
  actor: string;
  metadata_json: string | null;
  created_at: string;
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  created: <Package className="h-4 w-4" />,
  pending_payment: <CreditCard className="h-4 w-4" />,
  paid: <CheckCircle2 className="h-4 w-4" />,
  processing: <Package className="h-4 w-4" />,
  shipping: <Truck className="h-4 w-4" />,
  Dalam_Pengiriman: <Truck className="h-4 w-4" />,
  completed: <CheckCircle2 className="h-4 w-4" />,
  Terkirim: <CheckCircle2 className="h-4 w-4" />,
  cancelled: <XCircle className="h-4 w-4" />,
  failed: <AlertCircle className="h-4 w-4" />,
};

function formatEventTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function humanizeEvent(event: TimelineEvent): string {
  if (event.note) return event.note;
  const status = event.order_status || event.event_type;
  const map: Record<string, string> = {
    created: 'Pesanan dibuat',
    pending_payment: 'Menunggu pembayaran',
    paid: 'Pembayaran diterima',
    processing: 'Pesanan sedang diproses',
    shipping: 'Pesanan dikirim',
    Dalam_Pengiriman: 'Kurir dalam perjalanan',
    completed: 'Pesanan selesai',
    Terkirim: 'Pesanan telah diterima',
    cancelled: 'Pesanan dibatalkan',
    failed: 'Pengiriman gagal',
    COD: 'Pembayaran COD',
    assigned: 'Ditugaskan ke kurir',
    picked_up: 'Kurir mengambil pesanan',
    arrived: 'Kurir tiba di lokasi',
  };
  return map[status] || status.replace(/_/g, ' ');
}

export function OrderTimeline({ orderId }: { orderId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch(`/api/public/orders/${orderId}/timeline`)
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        if (data.ok) setEvents(data.events);
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [orderId]);

  if (loading) return <div className="h-20 animate-pulse rounded-xl bg-[#f7eddf]" />;
  if (events.length === 0) return null;

  return (
    <div className="space-y-1">
      {events.map((event, idx) => (
        <div key={event.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
              idx === 0
                ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                : 'border-[#d4c5b6] bg-[#f7eddf] text-[#7a6758]'
            }`}>
              {STATUS_ICONS[event.order_status || event.event_type] || <Clock className="h-4 w-4" />}
            </div>
            {idx < events.length - 1 && <div className="w-px flex-1 bg-[#ecd8bf]" />}
          </div>
          <div className={`pb-5 ${idx === 0 ? '' : 'pt-0.5'}`}>
            <p className={`text-sm font-medium ${idx === 0 ? 'text-emerald-700' : 'text-[#2f241c]'}`}>
              {humanizeEvent(event)}
            </p>
            <p className="text-xs text-[#8a7562]">{formatEventTime(event.created_at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
