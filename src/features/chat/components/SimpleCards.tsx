'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, CreditCard, Edit3, MapPinned, Navigation, PackageCheck, ShieldCheck, UserRound } from 'lucide-react';
import { PaymentProofUploader } from '@/components/order/PaymentProofUploader';
import { formatRupiah } from '@/lib/utils';
import type { AddressConfirmComponent, AdminHandoffComponent, CustomerConfirmComponent, OrderStatusComponent, OrderSummaryComponent, PaymentUploadComponent } from '@/lib/chat-v3/types';

const cardClass = 'rounded-[1.7rem] border border-[#f0dfca] bg-[rgba(255,250,244,0.9)] p-4 shadow-[0_14px_34px_rgba(47,36,28,0.05)] backdrop-blur';
const panelClass = 'mt-3 rounded-[1.2rem] bg-[#fbf2e7] p-3 text-sm leading-6 text-[#5f4d3f]';
const primaryButtonClass = 'inline-flex items-center justify-center gap-2 rounded-full bg-[#c55a2b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#ae4d23] disabled:cursor-not-allowed disabled:bg-[#d7c8ba]';
const secondaryButtonClass = 'inline-flex items-center justify-center gap-2 rounded-full border border-[#ecd8bf] bg-white px-4 py-2 text-sm font-medium text-[#2f241c] transition hover:bg-[#f7eddf]';
const inputClass = 'rounded-[1.2rem] border border-[#ecd8bf] bg-white px-4 py-3 text-sm text-[#2f241c] outline-none transition placeholder:text-[#9ca3af] focus:border-[#c55a2b]/30 focus:ring-4 focus:ring-[#c55a2b]/5';
type PaymentMethodOption = {
  id: string;
  type: string;
  label: string;
  note?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
};

export function CustomerConfirmCard({ component, onAction }: { component: CustomerConfirmComponent; onAction?: (action: string, payload?: Record<string, unknown>) => void }) {
  const customer = component.customer;
  return (
    <div className={cardClass}>
      <div className="flex items-center gap-2"><UserRound size={18} className="text-[#7f9f3e]" /><h3 className="font-semibold text-[#2f241c]">Data customer tersimpan</h3></div>
      <div className={panelClass}>
        <p>Nama: <span className="font-medium text-[#111827]">{customer?.name || 'Customer tersimpan'}</span></p>
        <p>Nomor WA: <span className="font-medium text-[#111827]">{customer?.phoneMasked || '********'}</span></p>
        {customer?.tags && customer.tags.length > 0 && <p className="mt-1 text-xs">Tag: {customer.tags.slice(0, 3).join(', ')}</p>}
      </div>
      <p className="mt-2 text-xs text-[#9ca3af]">Data ditampilkan masked agar tetap aman.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => onAction?.('use_saved_customer', { customerId: component.customerId || customer?.id })} className={primaryButtonClass}><ShieldCheck size={15} /> Pakai data ini</button>
        <button type="button" onClick={() => onAction?.('edit_customer_data')} className={secondaryButtonClass}><Edit3 size={15} /> Ubah data</button>
      </div>
    </div>
  );
}

export function AddressConfirmCard({ component, onAction }: { component: AddressConfirmComponent; onAction?: (action: string, payload?: Record<string, unknown>) => void }) {
  const address = component.address;
  return (
    <div className={cardClass}>
      <div className="flex items-center gap-2"><MapPinned size={18} className="text-[#7f9f3e]" /><h3 className="font-semibold text-[#2f241c]">Konfirmasi alamat</h3></div>
      <div className={panelClass}>
        <p className="font-medium text-[#111827]">{address?.label || 'Alamat tersimpan'}</p>
        <p className="mt-1">Penerima: {address?.recipientName || '-'}</p>
        <p>WA: {address?.phoneMasked || '-'}</p>
        <p className="mt-2 leading-5">{address?.addressSummary || 'Alamat tersimpan bisa dipakai untuk pesanan ini.'}</p>
        {(address?.latitude && address.longitude) && <p className="mt-2 text-xs text-[#16a34a]">Map preview tersedia: {address.latitude.slice(0, 9)}, {address.longitude.slice(0, 9)}</p>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => onAction?.('use_saved_address', { addressId: component.addressId || address?.id })} className={primaryButtonClass}><ShieldCheck size={15} /> Pakai alamat</button>
        <button type="button" onClick={() => onAction?.('edit_address')} className={secondaryButtonClass}><Navigation size={15} /> Ubah alamat</button>
      </div>
    </div>
  );
}

export function PaymentUploadCard({ component, onAction }: { component: PaymentUploadComponent; onAction?: (action: string, payload?: Record<string, unknown>) => void }) {
  if (component.statusToken) {
    return <PaymentProofUploader orderId={component.orderId} statusToken={component.statusToken} onUploaded={() => onAction?.('refresh_chat')} />;
  }

  return (
    <div className={cardClass}>
      <div className="flex items-center gap-2"><CreditCard size={18} className="text-[#c55a2b]" /><h3 className="font-semibold text-[#2f241c]">Upload bukti pembayaran</h3></div>
      <p className="mt-2 text-sm leading-6 text-[#6b7280]">Upload bukti tersedia di halaman status/sukses pesanan.</p>
      <Link href={`/pesan/lacak?code=${encodeURIComponent(component.orderId)}`} className={`${primaryButtonClass} mt-3`}>Buka status</Link>
    </div>
  );
}

export function OrderSummaryCard({ component, onAction }: { component: OrderSummaryComponent; onAction: (action: string, payload?: Record<string, unknown>) => void }) {
  const [step, setStep] = useState<'customer' | 'address' | 'payment' | 'review'>(component.savedCustomerId && component.savedAddressId ? 'review' : 'customer');
  const [customer, setCustomer] = useState({ name: '', phone: '', type: 'konsumen' });
  const [address, setAddress] = useState({ text: '', note: '', mapsLink: '', lat: '', lng: '' });
  const [paymentMethodId, setPaymentMethodId] = useState(component.paymentMethodId || '');
  const [notes, setNotes] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/payment-methods')
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        setPaymentMethods(data.methods || []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function canSubmit() {
    return customer.name.trim().length >= 2 && customer.phone.trim().length >= 8 && address.text.trim().length >= 8 && paymentMethodId.trim().length > 0;
  }

  function useLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      setAddress((current) => ({ ...current, lat: String(position.coords.latitude), lng: String(position.coords.longitude) }));
    });
  }

  return (
    <div className={cardClass}>
      <div className="flex items-center gap-2"><PackageCheck size={18} className="text-[#7f9f3e]" /><h3 className="font-semibold text-[#2f241c]">Buat order dari chat</h3></div>
      <p className="mt-2 text-sm leading-6 text-[#6b7280]">Aku minta data bertahap supaya order bisa masuk dashboard dengan benar.</p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center text-[11px] font-medium text-[#6b7280] sm:grid-cols-4">
        {(['customer', 'address', 'payment', 'review'] as const).map((item, index) => (
          <button key={item} type="button" onClick={() => setStep(item)} className={`rounded-full px-2 py-2 transition ${step === item ? 'bg-[#c55a2b] text-white' : 'bg-[#f7eddf] hover:bg-[#f2e2cc]'}`}>{index + 1}. {item === 'customer' ? 'Data' : item === 'address' ? 'Alamat' : item === 'payment' ? 'Bayar' : 'Review'}</button>
        ))}
      </div>
      {(component.savedCustomerId && component.savedAddressId && paymentMethodId) && (
        <button type="button" onClick={() => onAction('create_order_saved', { addressId: component.savedAddressId, paymentMethodId, notes })} className={`${primaryButtonClass} mt-4 w-full rounded-2xl py-3`}>
          Pakai Data Tersimpan & Buat Order
        </button>
      )}
      <div className="mt-4 grid gap-3">
        {step === 'customer' && <>
        <input data-testid="order-customer-name" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} placeholder="Nama penerima" className={inputClass} />
        <input data-testid="order-customer-phone" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} placeholder="Nomor WhatsApp" inputMode="tel" className={inputClass} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(['konsumen', 'warung', 'reseller'] as const).map((type) => (
            <button key={type} type="button" onClick={() => setCustomer({ ...customer, type })} className={`rounded-2xl border px-3 py-2 text-xs font-medium capitalize transition ${customer.type === type ? 'border-[#111827] bg-[#111827] text-white' : 'border-[#e5e7eb] bg-white text-[#4b5563] hover:bg-[#f3f4f6]'}`}>{type}</button>
          ))}
        </div>
        <button data-testid="order-step-address" type="button" disabled={customer.name.trim().length < 2 || customer.phone.trim().length < 8} onClick={() => setStep('address')} className={`${primaryButtonClass} rounded-2xl py-3`}>Lanjut alamat</button>
        </>}
        {step === 'address' && <>
        <textarea data-testid="order-address-text" value={address.text} onChange={(event) => setAddress({ ...address, text: event.target.value })} placeholder="Alamat lengkap" className={`${inputClass} min-h-20`} />
        <input data-testid="order-address-note" value={address.note} onChange={(event) => setAddress({ ...address, note: event.target.value })} placeholder="Patokan/catatan kurir" className={inputClass} />
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input data-testid="order-address-maps" value={address.mapsLink} onChange={(event) => setAddress({ ...address, mapsLink: event.target.value })} placeholder="Link Google Maps (opsional)" className={inputClass} />
          <button data-testid="order-address-geolocate" type="button" onClick={useLocation} className={`${secondaryButtonClass} rounded-2xl px-4 py-3`}>Ambil titik</button>
        </div>
        {(address.lat && address.lng) && <p className="rounded-[1.2rem] bg-[#eef6dd] px-4 py-3 text-xs font-medium text-[#56721f]">Koordinat tersimpan: {address.lat.slice(0, 10)}, {address.lng.slice(0, 10)}</p>}
        <button data-testid="order-step-payment" type="button" disabled={address.text.trim().length < 8} onClick={() => setStep('payment')} className={`${primaryButtonClass} rounded-2xl py-3`}>Lanjut pembayaran</button>
        </>}
        {step === 'payment' && <>
        <div className="rounded-[1.2rem] bg-[#fbf2e7] p-4 text-sm leading-6 text-[#5f4d3f]">
          Pilih metode pembayaran langsung dari daftar di bawah. Customer tidak perlu tahu ID internal.
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {paymentMethods.map((method) => (
            <button
              key={method.id}
              type="button"
              onClick={() => setPaymentMethodId(method.id)}
              className={`rounded-[1.2rem] border px-4 py-3 text-left transition ${
                paymentMethodId === method.id
                  ? 'border-[#c55a2b] bg-[#fff4ea] shadow-[0_10px_24px_rgba(197,90,43,0.08)]'
                  : 'border-[#ecd8bf] bg-white hover:bg-[#fdf6ee]'
              }`}
            >
              <p className="text-sm font-semibold text-[#2f241c]">{method.label}</p>
              <p className="mt-1 text-xs leading-5 text-[#6b7280]">
                {method.note || (method.type === 'cod' ? 'Bayar saat pesanan diterima.' : 'Pembayaran akan dicek admin.')}
              </p>
              {method.accountNumber && (
                <p className="mt-2 text-xs font-medium text-[#2f241c]">
                  {method.bankName}: {method.accountNumber}
                </p>
              )}
            </button>
          ))}
          {paymentMethods.length === 0 && (
            <div className="rounded-[1.2rem] border border-dashed border-[#ecd8bf] bg-white px-4 py-3 text-sm text-[#6b7280]">
              Metode pembayaran belum termuat. Coba lanjutkan sebentar lagi.
            </div>
          )}
        </div>
        <textarea data-testid="order-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Catatan pesanan opsional" className={`${inputClass} min-h-16`} />
        <button data-testid="order-step-review" type="button" disabled={!paymentMethodId.trim()} onClick={() => setStep('review')} className={`${primaryButtonClass} rounded-2xl py-3`}>Review order</button>
        </>}
        {step === 'review' && <div className="rounded-[1.2rem] bg-[#fbf2e7] p-4 text-sm leading-6 text-[#4b5563]">
          <p className="font-semibold text-[#2f241c]">Cek ulang sebelum order dibuat</p>
          <p className="mt-2">Nama: {customer.name || 'Data tersimpan'}</p>
          <p>WA: {customer.phone || 'Data tersimpan'}</p>
          <p>Alamat: {address.text || 'Alamat tersimpan'}</p>
          <p>Metode bayar: {paymentMethodId || 'Belum dipilih'}</p>
          {notes && <p>Catatan: {notes}</p>}
        </div>}
        {step === 'review' && (
        <button data-testid="order-submit" type="button" disabled={!canSubmit()} onClick={() => onAction('create_order', { customer, address, paymentMethodId, notes })} className={`${primaryButtonClass} rounded-2xl py-3`}>Konfirmasi & Buat Order</button>
        )}
      </div>
    </div>
  );
}

export function OrderStatusCard({ component }: { component: OrderStatusComponent }) {
  return (
    <div className={cardClass}>
      <div className="flex items-center gap-2"><CheckCircle2 size={18} className="text-[#7f9f3e]" /><h3 className="font-semibold text-[#2f241c]">Status pesanan</h3></div>
      <div className="mt-3 grid gap-2 text-sm text-[#4b5563]">
        <p>Order: {component.orderCode || component.orderId}</p>
        {component.status && <p>Status: {component.status}</p>}
        {component.paymentStatus && <p>Pembayaran: {component.paymentStatus}</p>}
        {component.deliveryStatus && <p>Pengiriman: {component.deliveryStatus}</p>}
        {component.totalAmount != null && <p>Total: {formatRupiah(component.totalAmount)}</p>}
      </div>
    </div>
  );
}

export function AdminHandoffCard({
  component,
  onSend,
}: {
  component: AdminHandoffComponent;
  onSend?: (message: string) => void;
}) {
  return (
    <div className="rounded-[1.7rem] border border-[#f3d2bf] bg-[#fff3ea] p-4 shadow-[0_14px_34px_rgba(47,36,28,0.05)]">
      <div className="flex items-center gap-2"><AlertTriangle size={18} className="text-[#c55a2b]" /><h3 className="font-semibold text-[#7b3111]">Butuh admin</h3></div>
      <p className="mt-2 text-sm leading-6 text-[#8b4c31]">{component.reason || 'Chat ini diteruskan ke admin untuk dicek lebih pasti.'}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSend?.('lihat produk')}
          className={secondaryButtonClass}
        >
          Lihat katalog
        </button>
        <Link href="/pesan/lacak" className={primaryButtonClass}>
          Buka order lama
        </Link>
      </div>
    </div>
  );
}
