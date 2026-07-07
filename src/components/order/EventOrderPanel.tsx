'use client';

import { useState, useTransition } from 'react';
import type { ChatUIResponse } from '@/lib/public-order/types';
import { formatRupiah } from '@/lib/utils';
import { PaymentProofUploader } from './PaymentProofUploader';

type UserEvent =
  | { type: 'text'; text: string }
  | { type: 'button_click'; action: string; value?: string }
  | { type: 'select_product'; productId: string }
  | { type: 'select_variant'; productId: string; variantId: string }
  | { type: 'set_quantity'; productId: string; variantId?: string; quantity: number }
  | { type: 'review_cart' }
  | { type: 'submit_customer_info'; values: { name: string; phone: string } }
  | { type: 'submit_address'; values: { recipientName: string; phone: string; addressText: string; landmark?: string; courierNote?: string } }
  | { type: 'select_payment_method'; paymentMethodId: string }
  | { type: 'confirm_order' }
  | { type: 'cancel_order'; reason?: string };

export function EventOrderPanel() {
  const [responses, setResponses] = useState<ChatUIResponse[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  async function sendEvent(event: UserEvent) {
    setError('');
    startTransition(async () => {
      try {
        const res = await fetch('/api/public/order-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setError(data.error || 'Aksi belum bisa diproses.');
          return;
        }
        setResponses(data.responses || []);
      } catch {
        setError('Panel interaktif sedang tidak tersedia. Gunakan form order utama.');
      }
    });
  }

  function submitText() {
    if (!text.trim()) return;
    void sendEvent({ type: 'text', text });
    setText('');
  }

  return (
    <section className="rounded-[2rem] border border-[#e5e7eb] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#6b7280]">Mode interaktif pesanan</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#111827]">Coba order via percakapan</h2>
          <p className="mt-2 text-sm text-[#6b7280]">Panel ini bersifat eksperimental. Form utama tetap menjadi jalur checkout stabil.</p>
        </div>
        <button type="button" disabled={isPending} onClick={() => sendEvent({ type: 'button_click', action: 'show_products' })} className="rounded-2xl bg-[#111827] px-4 py-3 text-sm font-medium text-white disabled:opacity-60">
          Lihat Produk
        </button>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
        <input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitText(); }} placeholder="Contoh: mau beli 2 original" className="rounded-2xl border border-[#d1d5db] px-4 py-3 text-sm outline-none focus:border-[#111827]/30" />
        <button type="button" onClick={submitText} disabled={isPending} className="rounded-2xl bg-[#111827] px-5 py-3 text-sm font-medium text-white disabled:opacity-60">Kirim Event</button>
      </div>

      {error && <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
      <div className="mt-4 space-y-3">
        {responses.map((response, index) => <ResponseCard key={`${response.type}-${index}`} response={response} sendEvent={sendEvent} />)}
      </div>
    </section>
  );
}

function ResponseCard({ response, sendEvent }: { response: ChatUIResponse; sendEvent: (event: UserEvent) => Promise<void> }) {
  if (response.type === 'text' || response.type === 'error') {
    return <div className="rounded-2xl bg-[#f7f7f8] p-4 text-sm text-[#4b5563]">{response.message}</div>;
  }

  if (response.type === 'quick_replies') {
    return (
      <div className="rounded-2xl bg-[#f7f7f8] p-4">
        <p className="font-semibold text-[#111827]">{response.message}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {response.options.map((option) => (
            <button key={`${option.action}-${option.value || option.label}`} type="button" onClick={() => option.action === 'select_payment_method' && option.value ? sendEvent({ type: 'select_payment_method', paymentMethodId: option.value }) : sendEvent({ type: 'button_click', action: option.action, value: option.value })} className="rounded-full border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-[#111827]">
              {option.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (response.type === 'product_cards') {
    return (
      <div className="rounded-2xl bg-[#f7f7f8] p-4">
        <p className="font-semibold text-[#111827]">{response.message}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {response.products.map((product) => (
            <article key={product.id} className="rounded-2xl border border-[#e5e7eb] bg-white p-4">
              <p className="font-semibold">{product.name}</p>
              <p className="mt-1 text-sm text-[#6b7280]">{product.description || product.categoryName || 'Produk Rumah Keripik'}</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="font-semibold text-[#111827]">{product.priceLabel}</span>
                <button type="button" disabled={product.stock <= 0} onClick={() => sendEvent({ type: 'select_product', productId: product.id })} className="rounded-full bg-[#111827] px-3 py-2 text-xs font-medium text-white disabled:bg-[#d1d5db]">Pilih</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (response.type === 'variant_picker') {
    return (
      <div className="rounded-2xl bg-[#f7f7f8] p-4">
        <p className="font-semibold text-[#111827]">{response.message}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {response.variants.map((variant) => (
            <button key={variant.id} disabled={variant.disabled} type="button" onClick={() => sendEvent({ type: 'select_variant', productId: response.productId, variantId: variant.id })} className="rounded-full border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-[#111827] disabled:opacity-40">
              {variant.label} - {variant.priceLabel}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (response.type === 'quantity_picker') {
    return (
      <div className="rounded-2xl bg-[#f7f7f8] p-4">
        <p className="font-semibold text-[#111827]">{response.message}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 2, 3, 5, 10].filter((qty) => qty <= response.max).map((qty) => (
            <button key={qty} type="button" onClick={() => sendEvent({ type: 'set_quantity', productId: response.productId, variantId: response.variantId, quantity: qty })} className="rounded-full border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-[#111827]">
              {qty} pcs
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (response.type === 'cart_summary') {
    return (
      <div className="rounded-2xl bg-[#111827] p-4 text-white">
        <p className="font-semibold">{response.message}</p>
        <div className="mt-3 space-y-2">
          {response.items.map((item) => <div key={`${item.productId}-${item.variantId || ''}`} className="flex justify-between gap-3 text-sm"><span>{item.quantity}x {item.name} {item.variantLabel || ''}</span><b>{formatRupiah(item.subtotal)}</b></div>)}
        </div>
        <div className="mt-3 border-t border-white/20 pt-3 text-right text-xl font-semibold">{response.subtotalLabel}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {response.actions.map((action) => <button key={action.action} type="button" onClick={() => sendEvent({ type: 'button_click', action: action.action, value: action.value })} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[#111827]">{action.label}</button>)}
        </div>
      </div>
    );
  }

  if (response.type === 'customer_info_form') {
    return <CustomerInfoForm response={response} sendEvent={sendEvent} />;
  }

  if (response.type === 'address_form') {
    return <AddressForm response={response} sendEvent={sendEvent} />;
  }

  if (response.type === 'payment_instruction') {
    return (
      <div className="rounded-2xl bg-[#f7f7f8] p-4 text-[#111827]">
        <p className="font-semibold">{response.message}</p>
        <div className="mt-3 rounded-2xl border border-[#e5e7eb] bg-white p-4">
          <p className="text-sm text-[#6b7280]">Kode pesanan</p>
          <p className="text-2xl font-semibold">{response.orderCode}</p>
          <p className="mt-2 text-sm text-[#6b7280]">Total</p>
          <p className="text-xl font-semibold text-[#111827]">{response.amountLabel}</p>
          <div className="mt-3 space-y-2">
            {response.paymentMethods.map((method) => (
              <div key={`${method.type}-${method.label}`} className="rounded-xl border border-[#e5e7eb] bg-[#fafafa] p-3 text-sm">
                <b>{method.label}</b>
                {method.note && <p className="mt-1 text-[#6b7280]">{method.note}</p>}
              </div>
            ))}
          </div>
        </div>
        {response.paymentMethods.some((method) => method.type !== 'cod') && (
          <PaymentProofUploader orderId={response.orderId} statusToken={(response as { statusToken?: string }).statusToken || ''} />
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`/pesan/status/${encodeURIComponent(response.orderCode)}${(response as { statusToken?: string }).statusToken ? `?token=${encodeURIComponent((response as { statusToken?: string }).statusToken || '')}` : ''}`} className="rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white">Lihat Status</a>
          <a href="/pesan/lacak" className="rounded-full border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-[#111827]">Lacak Pesanan</a>
        </div>
      </div>
    );
  }

  return null;
}

function CustomerInfoForm({ response, sendEvent }: { response: Extract<ChatUIResponse, { type: 'customer_info_form' }>; sendEvent: (event: UserEvent) => Promise<void> }) {
  const [values, setValues] = useState({ name: '', phone: '' });
  return (
    <div className="rounded-2xl bg-[#f7f7f8] p-4">
      <p className="font-semibold text-[#111827]">{response.message}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <input value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} placeholder="Nama" className="rounded-xl border border-[#d1d5db] px-3 py-3 text-sm" />
        <input value={values.phone} onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value }))} placeholder="Nomor HP/WA" className="rounded-xl border border-[#d1d5db] px-3 py-3 text-sm" />
      </div>
      <button type="button" onClick={() => sendEvent({ type: 'submit_customer_info', values })} className="mt-3 rounded-xl bg-[#111827] px-4 py-3 text-sm font-medium text-white">{response.submitLabel}</button>
    </div>
  );
}

function AddressForm({ response, sendEvent }: { response: Extract<ChatUIResponse, { type: 'address_form' }>; sendEvent: (event: UserEvent) => Promise<void> }) {
  const [values, setValues] = useState({ recipientName: '', phone: '', addressText: '', landmark: '', courierNote: '' });
  return (
    <div className="rounded-2xl bg-[#f7f7f8] p-4">
      <p className="font-semibold text-[#111827]">{response.message}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <input value={values.recipientName} onChange={(event) => setValues((current) => ({ ...current, recipientName: event.target.value }))} placeholder="Nama penerima" className="rounded-xl border border-[#d1d5db] px-3 py-3 text-sm" />
        <input value={values.phone} onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value }))} placeholder="Nomor penerima" className="rounded-xl border border-[#d1d5db] px-3 py-3 text-sm" />
        <textarea value={values.addressText} onChange={(event) => setValues((current) => ({ ...current, addressText: event.target.value }))} placeholder="Alamat lengkap" className="min-h-24 rounded-xl border border-[#d1d5db] px-3 py-3 text-sm md:col-span-2" />
        <input value={values.landmark} onChange={(event) => setValues((current) => ({ ...current, landmark: event.target.value }))} placeholder="Patokan" className="rounded-xl border border-[#d1d5db] px-3 py-3 text-sm" />
        <input value={values.courierNote} onChange={(event) => setValues((current) => ({ ...current, courierNote: event.target.value }))} placeholder="Catatan kurir" className="rounded-xl border border-[#d1d5db] px-3 py-3 text-sm" />
      </div>
      <button type="button" onClick={() => sendEvent({ type: 'submit_address', values })} className="mt-3 rounded-xl bg-[#111827] px-4 py-3 text-sm font-medium text-white">{response.submitLabel}</button>
    </div>
  );
}
