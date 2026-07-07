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
  }, [component.methodIds.join('|')]);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {methods.map((method) => (
        <button key={method.id} type="button" onClick={() => onAction('select_payment_method', { methodId: method.id })} className="rounded-[1.3rem] border border-[#e8c98d] bg-white p-4 text-left shadow-sm">
          {method.type === 'cod' ? <Truck className="mb-2 text-[#8d4b00]" /> : <Store className="mb-2 text-[#8d4b00]" />}
          <p className="font-black text-[#2a1606]">{method.label}</p>
          <p className="mt-1 text-xs font-bold text-[#735033]">{method.note || (method.type === 'cod' ? 'Admin konfirmasi COD sebelum diproses' : 'Pembayaran dicek manual admin')}</p>
          {method.accountNumber && <p className="mt-2 text-xs font-bold text-[#2a1606]">{method.bankName}: {method.accountNumber}</p>}
        </button>
      ))}
      {methods.length === 0 && <div className="rounded-3xl bg-white p-4 text-sm font-bold text-[#735033]">Metode pembayaran belum tersedia.</div>}
    </div>
  );
}
