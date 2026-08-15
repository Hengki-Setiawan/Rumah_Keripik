'use client';

import { useEffect, useState } from 'react';
import { Store, Truck } from 'lucide-react';
import type { PaymentMethodsComponent } from '@/lib/chat-v3/types';

type Method = { id: string; type: string; label: string; note?: string | null; accountNumber?: string | null; bankName?: string | null; accountName?: string | null; qrisImageUrl?: string | null };

export function PaymentMethodsCard({ component, onAction }: { component: PaymentMethodsComponent; onAction: (action: string, payload?: Record<string, unknown>) => void }) {
  const [methods, setMethods] = useState<Method[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/payment-methods')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const ids = new Set(component.methodIds);
        setMethods((data.methods || []).filter((method: Method) => ids.size === 0 || ids.has(method.id)));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [component.methodIds]);

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {methods.map((method) => (
          <button key={method.id} type="button" data-testid={`payment-method-${method.id}`} onClick={() => onAction('select_payment_method', { methodId: method.id })} className="rounded-[1.4rem] border border-[#f0dfca] bg-[rgba(255,250,244,0.88)] p-4 text-left shadow-[0_10px_24px_rgba(47,36,28,0.04)] transition hover:border-[#dfc5a8] hover:bg-white">
            {method.type === 'cod' ? <Truck className="mb-2 text-[#c55a2b]" /> : <Store className="mb-2 text-[#7f9f3e]" />}
            <p className="font-semibold text-[#2f241c]">{method.label}</p>
            <p className="mt-1 text-xs leading-5 text-[#6b7280]">{method.note || (method.type === 'cod' ? 'Admin konfirmasi COD sebelum diproses' : 'Pembayaran dibuka lewat checkout online dan status terupdate otomatis')}</p>
            {method.accountNumber && <p className="mt-2 text-xs font-medium text-[#2f241c]">{method.bankName}: {method.accountNumber}</p>}
          </button>
        ))}
        {methods.length === 0 && <div className="rounded-[1.4rem] border border-[#f0dfca] bg-[rgba(255,250,244,0.88)] p-4 text-sm text-[#6b7280]">Metode pembayaran belum tersedia.</div>}
      </div>
      <button type="button" onClick={() => onAction('show_cart')} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#ecd8bf] bg-white px-4 py-2 text-sm font-medium text-[#5f4d3f] transition hover:bg-[#f7eddf]">
        <span aria-hidden="true">&larr;</span> Kembali ke keranjang
      </button>
    </div>
  );
}
