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
    <div className="grid gap-3 sm:grid-cols-2">
      {methods.map((method) => (
        <button key={method.id} type="button" onClick={() => onAction('select_payment_method', { methodId: method.id })} className="rounded-2xl border border-[#e5e7eb] bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:border-[#d1d5db] hover:bg-[#f7f7f8]">
          {method.type === 'cod' ? <Truck className="mb-2 text-[#6b7280]" /> : <Store className="mb-2 text-[#6b7280]" />}
          <p className="font-semibold text-[#111827]">{method.label}</p>
          <p className="mt-1 text-xs leading-5 text-[#6b7280]">{method.note || (method.type === 'cod' ? 'Admin konfirmasi COD sebelum diproses' : 'Pembayaran dicek manual admin')}</p>
          {method.accountNumber && <p className="mt-2 text-xs font-medium text-[#111827]">{method.bankName}: {method.accountNumber}</p>}
        </button>
      ))}
      {methods.length === 0 && <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 text-sm text-[#6b7280]">Metode pembayaran belum tersedia.</div>}
    </div>
  );
}
