'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, CreditCard, Edit3, MapPinned, Navigation, PackageCheck, ShieldCheck, UserRound } from 'lucide-react';
import { PaymentProofUploader } from '@/components/order/PaymentProofUploader';
import { formatRupiah } from '@/lib/utils';
import type { AddressConfirmComponent, AdminHandoffComponent, CustomerConfirmComponent, OrderStatusComponent, OrderSummaryComponent, PaymentUploadComponent } from '@/lib/chat-v3/types';

export function CustomerConfirmCard({ component, onAction }: { component: CustomerConfirmComponent; onAction?: (action: string, payload?: Record<string, unknown>) => void }) {
  const customer = component.customer;
  return (
    <div className="rounded-[1.4rem] border border-[#e8c98d] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2"><UserRound size={18} className="text-[#8d4b00]" /><h3 className="font-black text-[#2a1606]">Data Customer Tersimpan</h3></div>
      <div className="mt-3 rounded-2xl bg-[#fff8e8] p-3 text-sm font-bold text-[#735033]">
        <p>Nama: <span className="text-[#2a1606]">{customer?.name || 'Customer tersimpan'}</span></p>
        <p>Nomor WA: <span className="text-[#2a1606]">{customer?.phoneMasked || '********'}</span></p>
        {customer?.tags && customer.tags.length > 0 && <p className="mt-1 text-xs">Tag: {customer.tags.slice(0, 3).join(', ')}</p>}
      </div>
      <p className="mt-2 text-xs font-bold text-[#8c6a4c]">Data ditampilkan masked agar tetap aman.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => onAction?.('use_saved_customer', { customerId: component.customerId || customer?.id })} className="inline-flex items-center gap-2 rounded-full bg-[#123524] px-4 py-2 text-sm font-black text-white"><ShieldCheck size={15} /> Pakai data ini</button>
        <button type="button" onClick={() => onAction?.('edit_customer_data')} className="inline-flex items-center gap-2 rounded-full bg-[#fff0c2] px-4 py-2 text-sm font-black text-[#7a3f00]"><Edit3 size={15} /> Ubah data</button>
      </div>
    </div>
  );
}

export function AddressConfirmCard({ component, onAction }: { component: AddressConfirmComponent; onAction?: (action: string, payload?: Record<string, unknown>) => void }) {
  const address = component.address;
  return (
    <div className="rounded-[1.4rem] border border-[#e8c98d] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2"><MapPinned size={18} className="text-[#8d4b00]" /><h3 className="font-black text-[#2a1606]">Konfirmasi Alamat</h3></div>
      <div className="mt-3 rounded-2xl bg-[#fff8e8] p-3 text-sm font-bold text-[#735033]">
        <p className="text-[#2a1606]">{address?.label || 'Alamat tersimpan'}</p>
        <p className="mt-1">Penerima: {address?.recipientName || '-'}</p>
        <p>WA: {address?.phoneMasked || '-'}</p>
        <p className="mt-2 leading-5">{address?.addressSummary || 'Alamat tersimpan bisa dipakai untuk pesanan ini.'}</p>
        {(address?.latitude && address.longitude) && <p className="mt-2 text-xs text-[#287243]">Map preview tersedia: {address.latitude.slice(0, 9)}, {address.longitude.slice(0, 9)}</p>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => onAction?.('use_saved_address', { addressId: component.addressId || address?.id })} className="inline-flex items-center gap-2 rounded-full bg-[#123524] px-4 py-2 text-sm font-black text-white"><ShieldCheck size={15} /> Pakai alamat</button>
        <button type="button" onClick={() => onAction?.('request_location')} className="inline-flex items-center gap-2 rounded-full bg-[#fff0c2] px-4 py-2 text-sm font-black text-[#7a3f00]"><Navigation size={15} /> Kirim lokasi baru</button>
      </div>
    </div>
  );
}

export function PaymentUploadCard({ component, onAction }: { component: PaymentUploadComponent; onAction?: (action: string, payload?: Record<string, unknown>) => void }) {
  if (component.statusToken) {
    return <PaymentProofUploader orderId={component.orderId} statusToken={component.statusToken} onUploaded={() => onAction?.('refresh_chat')} />;
  }

  return (
    <div className="rounded-[1.4rem] border border-[#e8c98d] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2"><CreditCard size={18} className="text-[#8d4b00]" /><h3 className="font-black text-[#2a1606]">Upload Bukti Pembayaran</h3></div>
      <p className="mt-2 text-sm font-bold text-[#735033]">Upload bukti tersedia di halaman status/sukses pesanan.</p>
      <a href={`/pesan/lacak?code=${encodeURIComponent(component.orderId)}`} className="mt-3 inline-block rounded-full bg-[#8d4b00] px-4 py-2 text-sm font-black text-white">Buka status</a>
    </div>
  );
}

export function OrderSummaryCard({ component, onAction }: { component: OrderSummaryComponent; onAction: (action: string, payload?: Record<string, unknown>) => void }) {
  const [step, setStep] = useState<'customer' | 'address' | 'payment' | 'review'>(component.savedCustomerId && component.savedAddressId ? 'review' : 'customer');
  const [customer, setCustomer] = useState({ name: '', phone: '', type: 'konsumen' });
  const [address, setAddress] = useState({ text: '', note: '', mapsLink: '', lat: '', lng: '' });
  const [paymentMethodId, setPaymentMethodId] = useState(component.paymentMethodId || '');
  const [notes, setNotes] = useState('');

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
    <div className="rounded-[1.4rem] border border-[#e8c98d] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2"><PackageCheck size={18} className="text-[#8d4b00]" /><h3 className="font-black text-[#2a1606]">Buat Order dari Chat</h3></div>
      <p className="mt-2 text-sm font-bold text-[#735033]">Aku minta data bertahap supaya order bisa masuk dashboard dengan benar.</p>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[11px] font-black text-[#735033]">
        {(['customer', 'address', 'payment', 'review'] as const).map((item, index) => (
          <button key={item} type="button" onClick={() => setStep(item)} className={`rounded-full px-2 py-2 ${step === item ? 'bg-[#2a1606] text-white' : 'bg-[#fff0c2]'}`}>{index + 1}. {item === 'customer' ? 'Data' : item === 'address' ? 'Alamat' : item === 'payment' ? 'Bayar' : 'Review'}</button>
        ))}
      </div>
      {(component.savedCustomerId && component.savedAddressId && paymentMethodId) && (
        <button type="button" onClick={() => onAction('create_order_saved', { addressId: component.savedAddressId, paymentMethodId, notes })} className="mt-4 w-full rounded-2xl bg-[#123524] px-5 py-3 text-sm font-black text-white">
          Pakai Data Tersimpan & Buat Order
        </button>
      )}
      <div className="mt-4 grid gap-3">
        {step === 'customer' && <>
        <input value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} placeholder="Nama penerima" className="rounded-2xl border border-[#dfbd83] bg-[#fff8e8] px-4 py-3 text-sm font-bold outline-none focus:border-[#8d4b00]" />
        <input value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} placeholder="Nomor WhatsApp" inputMode="tel" className="rounded-2xl border border-[#dfbd83] bg-[#fff8e8] px-4 py-3 text-sm font-bold outline-none focus:border-[#8d4b00]" />
        <div className="grid grid-cols-3 gap-2">
          {(['konsumen', 'warung', 'reseller'] as const).map((type) => (
            <button key={type} type="button" onClick={() => setCustomer({ ...customer, type })} className={`rounded-2xl border px-3 py-2 text-xs font-black capitalize ${customer.type === type ? 'border-[#8d4b00] bg-[#ffe2aa]' : 'border-[#dfbd83] bg-white'}`}>{type}</button>
          ))}
        </div>
        <button type="button" disabled={customer.name.trim().length < 2 || customer.phone.trim().length < 8} onClick={() => setStep('address')} className="rounded-2xl bg-[#8d4b00] px-5 py-3 text-sm font-black text-white disabled:bg-[#c9b9a3]">Lanjut alamat</button>
        </>}
        {step === 'address' && <>
        <textarea value={address.text} onChange={(event) => setAddress({ ...address, text: event.target.value })} placeholder="Alamat lengkap" className="min-h-20 rounded-2xl border border-[#dfbd83] bg-[#fff8e8] px-4 py-3 text-sm font-bold outline-none focus:border-[#8d4b00]" />
        <input value={address.note} onChange={(event) => setAddress({ ...address, note: event.target.value })} placeholder="Patokan/catatan kurir" className="rounded-2xl border border-[#dfbd83] bg-[#fff8e8] px-4 py-3 text-sm font-bold outline-none focus:border-[#8d4b00]" />
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input value={address.mapsLink} onChange={(event) => setAddress({ ...address, mapsLink: event.target.value })} placeholder="Link Google Maps (opsional)" className="rounded-2xl border border-[#dfbd83] bg-[#fff8e8] px-4 py-3 text-sm font-bold outline-none focus:border-[#8d4b00]" />
          <button type="button" onClick={useLocation} className="rounded-2xl bg-[#123524] px-4 py-3 text-sm font-black text-white">Ambil titik</button>
        </div>
        {(address.lat && address.lng) && <p className="rounded-2xl bg-[#e9f8dd] px-4 py-3 text-xs font-bold text-[#256f31]">Koordinat tersimpan: {address.lat.slice(0, 10)}, {address.lng.slice(0, 10)}</p>}
        <button type="button" disabled={address.text.trim().length < 8} onClick={() => setStep('payment')} className="rounded-2xl bg-[#8d4b00] px-5 py-3 text-sm font-black text-white disabled:bg-[#c9b9a3]">Lanjut pembayaran</button>
        </>}
        {step === 'payment' && <>
        <input value={paymentMethodId} onChange={(event) => setPaymentMethodId(event.target.value)} placeholder="ID metode pembayaran" className="rounded-2xl border border-[#dfbd83] bg-[#fff8e8] px-4 py-3 text-sm font-bold outline-none focus:border-[#8d4b00]" />
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Catatan pesanan opsional" className="min-h-16 rounded-2xl border border-[#dfbd83] bg-[#fff8e8] px-4 py-3 text-sm font-bold outline-none focus:border-[#8d4b00]" />
        <button type="button" disabled={!paymentMethodId.trim()} onClick={() => setStep('review')} className="rounded-2xl bg-[#8d4b00] px-5 py-3 text-sm font-black text-white disabled:bg-[#c9b9a3]">Review order</button>
        </>}
        {step === 'review' && <div className="rounded-2xl bg-[#fff8e8] p-4 text-sm font-bold text-[#735033]">
          <p className="font-black text-[#2a1606]">Cek ulang sebelum order dibuat</p>
          <p className="mt-2">Nama: {customer.name || 'Data tersimpan'}</p>
          <p>WA: {customer.phone || 'Data tersimpan'}</p>
          <p>Alamat: {address.text || 'Alamat tersimpan'}</p>
          <p>Metode bayar: {paymentMethodId || 'Belum dipilih'}</p>
          {notes && <p>Catatan: {notes}</p>}
        </div>}
        {step === 'review' && (
        <button type="button" disabled={!canSubmit()} onClick={() => onAction('create_order', { customer, address, paymentMethodId, notes })} className="rounded-2xl bg-[#8d4b00] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#c9b9a3]">Konfirmasi & Buat Order</button>
        )}
      </div>
    </div>
  );
}

export function OrderStatusCard({ component }: { component: OrderStatusComponent }) {
  return (
    <div className="rounded-[1.4rem] border border-[#e8c98d] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2"><CheckCircle2 size={18} className="text-[#287243]" /><h3 className="font-black text-[#2a1606]">Status Pesanan</h3></div>
      <div className="mt-3 grid gap-2 text-sm font-bold text-[#735033]">
        <p>Order: {component.orderCode || component.orderId}</p>
        {component.status && <p>Status: {component.status}</p>}
        {component.paymentStatus && <p>Pembayaran: {component.paymentStatus}</p>}
        {component.deliveryStatus && <p>Pengiriman: {component.deliveryStatus}</p>}
        {component.totalAmount != null && <p>Total: {formatRupiah(component.totalAmount)}</p>}
      </div>
    </div>
  );
}

export function AdminHandoffCard({ component }: { component: AdminHandoffComponent }) {
  return (
    <div className="rounded-[1.4rem] border border-orange-200 bg-orange-50 p-4 shadow-sm">
      <div className="flex items-center gap-2"><AlertTriangle size={18} className="text-orange-700" /><h3 className="font-black text-orange-950">Butuh Admin</h3></div>
      <p className="mt-2 text-sm font-bold text-orange-800">{component.reason || 'Chat ini diteruskan ke admin untuk dicek lebih pasti.'}</p>
    </div>
  );
}
