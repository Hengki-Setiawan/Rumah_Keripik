'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, CheckCircle2, ClipboardCheck, CreditCard, ExternalLink, KeyRound, MapPinPlus, MapPinned, Navigation, PackageCheck, RefreshCcw, Rocket, ShieldCheck, UserRound } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';
import type { AddressConfirmComponent, AdminHandoffComponent, CustomerConfirmComponent, OrderStatusComponent, OrderSummaryComponent, PaymentUploadComponent, PhoneOtpComponent } from '@/lib/chat-v3/types';

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

/**
 * CustomerConfirmCard — hasil identifikasi progresif sukses.
 * Diproduksi setelah OTP login/register berhasil: menampilkan data masked
 * yang tersimpan dan memberi jalan cepat ke langkah berikutnya.
 */
export function CustomerConfirmCard({ component, onAction }: { component: CustomerConfirmComponent; onAction?: (action: string, payload?: Record<string, unknown>) => void }) {
  const customer = component.customer;
  const name = customer?.name || 'Customer tersimpan';
  return (
    <div className={cardClass}>
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-[#7f9f3e]" />
        <h3 className="font-semibold text-[#2f241c]">Identitas terverifikasi</h3>
      </div>
      <div className={panelClass}>
        <p>Nama: <span className="font-medium text-[#111827]">{name}</span></p>
        <p>Nomor WA: <span className="font-medium text-[#111827]">{customer?.phoneMasked || '********'}</span></p>
        {customer?.tags && customer.tags.length > 0 && <p className="mt-1 text-xs">Tag: {customer.tags.slice(0, 3).join(', ')}</p>}
      </div>
      <p className="mt-2 flex items-center gap-1 text-xs text-[#16a34a]"><Check size={13} className="shrink-0" /> Data tersimpan akan dipakai otomatis untuk checkout.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" data-testid="customer-confirm-continue" onClick={() => onAction?.('continue_checkout')} className={primaryButtonClass}><Rocket size={15} /> Lanjut checkout</button>
        <Link href="/pesan/saya" className={secondaryButtonClass}><ClipboardCheck size={15} /> Pesanan saya</Link>
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
        <button type="button" onClick={() => onAction?.('send_new_location')} className={secondaryButtonClass}><Navigation size={15} /> Kirim lokasi baru</button>
      </div>
    </div>
  );
}

export function PaymentUploadCard({ component, onAction }: { component: PaymentUploadComponent; onAction?: (action: string, payload?: Record<string, unknown>) => void }) {
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [polling, setPolling] = useState(false);

  // Poll status pembayaran setiap 8 detik saat QRIS ditampilkan
  useEffect(() => {
    if (!component.qrCodeUrl || !component.orderId) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval>;

    async function checkPaymentStatus() {
      try {
        const response = await fetch(`/api/public/payment-status?orderId=${encodeURIComponent(component.orderId)}`);
        const data = await response.json();
        if (cancelled) return;
        if (data.ok && (data.status === 'settlement' || data.status === 'capture' || data.paymentStatus === 'verified' || data.paymentStatus === 'paid')) {
          setPaymentVerified(true);
          clearInterval(interval);
        }
      } catch {
        // Non-blocking
      }
    }

    const startDelay = setTimeout(() => {
      setPolling(true);
      checkPaymentStatus();
      interval = setInterval(checkPaymentStatus, 8000);
    }, 10000);

    return () => {
      cancelled = true;
      clearTimeout(startDelay);
      clearInterval(interval);
      setPolling(false);
    };
  }, [component.qrCodeUrl, component.orderId]);

  if (paymentVerified) {
    return (
      <div className={cardClass}>
        <div className="flex items-center gap-2">
          <CheckCircle2 size={20} className="text-[#16a34a]" />
          <h3 className="font-semibold text-[#16a34a]">Pembayaran Diterima!</h3>
        </div>
        <p className="mt-2 text-sm leading-6 text-[#4b5563]">Terima kasih kak! Pesanan kamu sudah masuk dan sedang diproses oleh tim kami.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/pesan/saya" className={primaryButtonClass}>Lihat Status Pesanan</Link>
          <button type="button" onClick={() => onAction?.('refresh_chat')} className={secondaryButtonClass}>Refresh Chat</button>
        </div>
      </div>
    );
  }

  if (component.qrCodeUrl) {
    return (
      <div className={cardClass}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-[#c55a2b]" />
            <h3 className="font-semibold text-[#2f241c]">Scan QRIS untuk Membayar</h3>
          </div>
          {polling && (
            <span className="flex items-center gap-1 rounded-full bg-[#eef6dd] px-2 py-0.5 text-[10px] font-medium text-[#56721f]">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#56721f]"></span>
              Menunggu pembayaran...
            </span>
          )}
        </div>
        <div className="mt-3 bg-white p-3 rounded-2xl border border-[#ecd8bf] text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={component.qrCodeUrl} alt="QRIS Midtrans" className="mx-auto max-h-60 object-contain rounded-xl" />
        </div>
        <p className="mt-2 text-xs leading-5 text-[#6b7280]">
          Total nominal: <span className="font-semibold text-[#2f241c]">{formatRupiah(component.amount || 0)}</span>.
          Pindai QRIS di atas dengan GoPay, ShopeePay, DANA, OVO, LinkAja, atau Mobile Banking.
          QRIS berlaku selama 24 jam.
        </p>
        {component.qrCodeUrl && (
          <a href={component.qrCodeUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#ecd8bf] bg-white px-4 py-2 text-xs font-medium text-[#c55a2b] transition hover:bg-[#f7eddf]">
            <ExternalLink size={13} /> Buka QRIS di tab baru (untuk scan dari perangkat lain)
          </a>
        )}
        {component.items && component.items.length > 0 && (
          <div className="mt-3 rounded-2xl border border-[#ecd8bf] bg-white p-3 text-sm">
            <p className="mb-2 font-semibold text-[#2f241c]">Rincian pesanan</p>
            <ul className="space-y-1.5">
              {component.items.map((item, index) => (
                <li key={index} className="flex items-baseline justify-between gap-2 text-[#4b5563]">
                  <span className="min-w-0">{item.quantity}&times; {item.name}{item.variantName ? ` (${item.variantName})` : ''}</span>
                  <span className="shrink-0 font-medium text-[#2f241c]">{formatRupiah(item.subtotal)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-[#f0dfca] pt-2">
              <span className="font-semibold text-[#2f241c]">Total</span>
              <span className="font-semibold text-[#c55a2b]">{formatRupiah(component.amount || 0)}</span>
            </div>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => onAction?.('refresh_chat')} className={primaryButtonClass}>
            Saya Sudah Bayar
          </button>
          <Link href="/pesan/saya" className={secondaryButtonClass}>
            Buka Pesanan Saya
          </Link>
        </div>
      </div>
    );
  }

  // Pembayaran manual/QRIS tidak tersedia di chat — arahkan ke checkout online.
  return (
    <div className={cardClass}>
      <div className="flex items-center gap-2">
        <CreditCard size={18} className="text-[#c55a2b]" />
        <h3 className="font-semibold text-[#2f241c]">Lanjutkan pembayaran</h3>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#6b7280]">
        {component.statusToken
          ? 'Pembayaran pesanan perlu dicek ulang. Buka Pesanan Saya untuk melanjutkan checkout online atau menghubungi admin.'
          : 'Checkout online belum siap dari chat. Buka Pesanan Saya untuk melanjutkan pembayaran.'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/pesan/saya" className={primaryButtonClass}>Buka Pesanan Saya</Link>
        <button type="button" onClick={() => onAction?.('refresh_chat')} className={secondaryButtonClass}>Refresh Chat</button>
      </div>
    </div>
  );
}

/**
 * OrderSummaryCard — kartu konfirmasi order berbasis data teridentifikasi.
 * BUKAN form manual: identitas/alamat datang dari flow progresif OTP.
 * Jika customer belum teridentifikasi, dorong verifikasi WhatsApp dulu.
 */
export function OrderSummaryCard({ component, onAction }: { component: OrderSummaryComponent; onAction: (action: string, payload?: Record<string, unknown>) => void }) {
  const [selectedAddressId, setSelectedAddressId] = useState<number | undefined>(component.savedAddressId || component.addresses?.[0]?.id || component.address?.id);
  const [paymentMethodId, setPaymentMethodId] = useState(component.paymentMethodId || '');
  const [notes, setNotes] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);

  const savedCustomerId = component.savedCustomerId;
  const addresses = component.addresses?.length ? component.addresses : (component.address ? [component.address] : []);
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || addresses[0];

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/payment-methods')
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const methods = data.methods || [];
        setPaymentMethods(methods);
        if (!component.paymentMethodId && methods.length > 0) setPaymentMethodId(methods[0].id);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [component.paymentMethodId]);

  const paymentLabel = paymentMethods.find((m) => m.id === paymentMethodId)?.label || component.paymentMethodLabel || 'Belum dipilih';

  // BELUM TERIDENTIFIKASI → dorong verifikasi WhatsApp, bukan form manual.
  if (!savedCustomerId) {
    return (
      <div className={cardClass} data-testid="order-summary-identify">
        <div className="flex items-center gap-2"><KeyRound size={18} className="text-[#c55a2b]" /><h3 className="font-semibold text-[#2f241c]">Lanjut checkout</h3></div>
        <div className="mt-3 rounded-[1.35rem] border border-[#ecd8bf] bg-[#fffaf3] p-4 text-center shadow-[0_8px_20px_rgba(47,36,28,0.03)]">
          <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#8b4c31] mb-1"><ShieldCheck size={14} className="shrink-0" /> Verifikasi WhatsApp dulu, ya</p>
          <p className="text-[11px] text-[#6f5d4f] mb-2.5">Setelah diverifikasi, data nama & alamat kakak langsung terisi otomatis — tanpa isi ulang.</p>
          <button
            type="button"
            data-testid="order-summary-request-identity"
            onClick={() => onAction('request_identity')}
            className="inline-flex min-h-8 items-center justify-center rounded-full bg-[#c55a2b] px-4 py-1.5 text-xs font-semibold text-white shadow-[0_6px_14px_rgba(197,90,43,0.12)] transition hover:bg-[#ae4d23]"
          >
            Verifikasi WhatsApp
          </button>
        </div>
      </div>
    );
  }

  function canSubmit() {
    return Boolean(selectedAddress) && Boolean(paymentMethodId.trim());
  }

  return (
    <div className={cardClass} data-testid="order-summary-confirm">
      <div className="flex items-center gap-2"><PackageCheck size={18} className="text-[#7f9f3e]" /><h3 className="font-semibold text-[#2f241c]">Konfirmasi pesanan</h3></div>
      <p className="mt-2 text-sm leading-6 text-[#6b7280]">Data penerima & alamat sudah dimuat dari akun kakak. Cek sekali lagi sebelum order dibuat, ya.</p>

      <div className="mt-4 space-y-4">
        {/* Penerima */}
        <div className={panelClass}>
          <p className="flex items-center gap-1.5 font-semibold text-[#2f241c]"><UserRound size={14} className="text-[#c55a2b]" /> Penerima</p>
          <p className="mt-1">Nama: <span className="font-medium text-[#111827]">{component.customer?.name || 'Customer tersimpan'}</span></p>
          <p>WA: <span className="font-medium text-[#111827]">{component.customer?.phoneMasked || '********'}</span></p>
        </div>

        {/* Alamat */}
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#5f4d3f]"><MapPinPlus size={13} className="text-[#c55a2b]" /> Alamat pengiriman</p>
          {addresses.length > 0 ? (
            <>
              <select
                data-testid="order-summary-address"
                value={selectedAddressId ?? ''}
                onChange={(e) => setSelectedAddressId(Number(e.target.value))}
                className={`${inputClass} w-full`}
              >
                {addresses.map((addr) => (
                  <option key={addr.id} value={addr.id}>{addr.label || 'Alamat'} — {addr.recipientName || 'Penerima'}</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs leading-5 text-[#6b7280]">{selectedAddress?.addressSummary || ''}</p>
            </>
          ) : (
            <button type="button" data-testid="order-summary-new-address" onClick={() => onAction('request_location')} className={`${secondaryButtonClass} w-full`}>
              <Navigation size={14} /> Belum ada alamat — kirim lokasi dulu
            </button>
          )}
        </div>

        {/* Metode pembayaran */}
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#5f4d3f]"><CreditCard size={13} className="text-[#c55a2b]" /> Metode pembayaran</p>
          <select
            data-testid="order-summary-payment"
            value={paymentMethodId}
            onChange={(e) => setPaymentMethodId(e.target.value)}
            className={`${inputClass} w-full`}
          >
            <option value="">-- Pilih metode bayar --</option>
            {paymentMethods.map((method) => (
              <option key={method.id} value={method.id}>{method.label}</option>
            ))}
          </select>
          {paymentLabel !== 'Belum dipilih' && (
            <p className="mt-1.5 text-xs text-[#6b7280]">{paymentLabel}</p>
          )}
        </div>

        {/* Catatan */}
        <div>
          <textarea
            data-testid="order-summary-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Catatan pesanan opsional (mis. jangan terlalu pedas)"
            className={`${inputClass} min-h-16 w-full`}
          />
        </div>
      </div>

      <button
        type="button"
        data-testid="order-summary-submit"
        disabled={!canSubmit()}
        onClick={() => {
          if (!selectedAddress) return;
          onAction('create_order_saved', { addressId: selectedAddress.id, paymentMethodId, notes });
        }}
        className={`${primaryButtonClass} mt-4 w-full rounded-2xl py-3 text-base font-semibold`}
      >
        <Rocket size={16} className="shrink-0" /> Konfirmasi &amp; Buat Order
      </button>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button type="button" data-testid="order-summary-back-cart" onClick={() => onAction('show_cart')} className={secondaryButtonClass}>
          <span aria-hidden="true">&larr;</span> Kembali ke keranjang
        </button>
        <span className="text-[11px] text-[#9ca3af]">Mau ubah data? Bisa di chat — ketik nama/alamat baru.</span>
      </div>
    </div>
  );
}

const ORDER_STATUS_STEPS = [
  { key: 'created', label: 'Dibuat' },
  { key: 'paid', label: 'Pembayaran' },
  { key: 'processing', label: 'Diproses' },
  { key: 'shipping', label: 'Dikirim' },
  { key: 'completed', label: 'Selesai' },
] as const;

function statusStepIndex(status: string | undefined, paymentStatus: string | undefined): number {
  const s = (status || '').toLowerCase();
  const p = (paymentStatus || '').toLowerCase();
  if (s === 'cancelled' || p === 'cancelled') return -1;
  if (s === 'completed' || s === 'delivered') return 4;
  if (s === 'shipping' || s === 'dalam_pengiriman' || s === 'dalam pengiriman') return 3;
  if (s === 'processing' || p === 'verified' || p === 'cod_approved' || p === 'settlement' || p === 'capture') return 2;
  if (p === 'proof_uploaded' || p === 'awaiting_admin_verification' || p === 'paid') return 1;
  return 0;
}

function paymentLabel(status: string | undefined, paymentStatus: string | undefined): { text: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } {
  const s = (status || '').toLowerCase();
  const p = (paymentStatus || '').toLowerCase();
  if (s === 'cancelled' || p === 'cancelled') return { text: 'Dibatalkan', tone: 'danger' };
  if (p === 'verified' || p === 'settlement' || p === 'capture' || p === 'paid' || p === 'cod_approved') return { text: 'Lunas', tone: 'success' };
  if (p === 'proof_uploaded' || p === 'awaiting_admin_verification') return { text: 'Menunggu verifikasi', tone: 'warning' };
  return { text: 'Menunggu pembayaran', tone: 'warning' };
}

export function OrderStatusCard({ component }: { component: OrderStatusComponent }) {
  const step = statusStepIndex(component.status, component.paymentStatus);
  const payment = paymentLabel(component.status, component.paymentStatus);
  const needsPayment = step <= 1 && payment.tone === 'warning';
  const toneText = { success: 'text-[#16a34a]', warning: 'text-[#c55a2b]', danger: 'text-[#dc2626]', neutral: 'text-[#6b7280]' }[payment.tone];

  return (
    <div className={cardClass} data-testid="order-status-card">
      <div className="flex items-center gap-2"><ClipboardCheck size={18} className="text-[#7f9f3e]" /><h3 className="font-semibold text-[#2f241c]">Status pesanan</h3></div>
      <p className="mt-1 text-xs text-[#6b7280]">Order: {component.orderCode || component.orderId}</p>

      {/* Stepper */}
      <div className="mt-4 grid grid-cols-5 gap-1">
        {ORDER_STATUS_STEPS.map((item, index) => {
          const done = step >= index && step !== -1;
          const current = step === index && step !== -1;
          return (
            <div key={item.key} className="flex flex-col items-center gap-1.5 text-center">
              <div className={`grid h-8 w-8 place-items-center rounded-full text-xs font-semibold transition ${step === -1 ? 'bg-[#f3ede2] text-[#b9a98f]' : done ? 'bg-[#7f9f3e] text-white' : current ? 'bg-[#c55a2b] text-white ring-4 ring-[#c55a2b]/15' : 'bg-[#f3ede2] text-[#b9a98f]'}`}>
                {done ? <Check size={14} /> : index + 1}
              </div>
              <span className={`text-[10px] leading-tight ${done || current ? 'font-semibold text-[#2f241c]' : 'text-[#b9a98f]'}`}>{item.label}</span>
            </div>
          );
        })}
      </div>

      <div className={`mt-3 flex items-center justify-between gap-2 rounded-[1.2rem] px-4 py-3 text-sm font-medium ${payment.tone === 'success' ? 'bg-[#eef6dd]' : payment.tone === 'danger' ? 'bg-[#fff0ec]' : 'bg-[#fbf2e7]'}`}>
        <span className={toneText}>{payment.text}</span>
        {component.totalAmount != null && <span className="font-semibold text-[#2f241c]">{formatRupiah(component.totalAmount)}</span>}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {needsPayment && (
          <Link href="/pesan/saya" className={primaryButtonClass}><CreditCard size={15} /> Bayar sekarang</Link>
        )}
        <Link href="/pesan/saya" className={needsPayment ? secondaryButtonClass : primaryButtonClass}><ClipboardCheck size={15} /> Buka Pesanan Saya</Link>
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
        <Link href="/pesan/saya" className={primaryButtonClass}>
          Buka order lama
        </Link>
      </div>
    </div>
  );
}

export function PhoneOtpCard({ component, onSend }: { component: PhoneOtpComponent; onSend?: (message: string) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(() => (component.expiresInSeconds ?? 300) || 300);

  useEffect(() => {
    if (!component.otpSent) return;
    const end = Date.now() + secondsLeft * 1000;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [component.otpSent, component.expiresInSeconds]);

  function handleVerify() {
    if (code.trim().length !== 6) {
      setError('Kode OTP terdiri dari 6 digit angka.');
      return;
    }
    setError('');
    setVerifying(true);
    onSend?.(code.trim());
  }

  return (
    <div className={cardClass} data-testid="phone-otp-card">
      <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-[#7f9f3e]" /><h3 className="font-semibold text-[#2f241c]">Verifikasi nomor WhatsApp</h3></div>
      <div className={panelClass}>
        {component.otpSent ? (
          <p>Kode OTP sudah dikirim ke <span className="font-medium text-[#111827]">{component.phoneMasked || 'nomor kakak'}</span>. Ketik 6 digit kodenya di bawah atau balas langsung di chat.</p>
        ) : (
          <p>Kode OTP akan dikirim ke WhatsApp kakak untuk memastikan nomor ini milik kakak.</p>
        )}
        {component.phoneFound && component.purpose === 'login' && (
          <p className="mt-2 flex items-center gap-1 text-xs text-[#16a34a]"><CheckCircle2 size={13} className="shrink-0" /> Nomor terdaftar — data tersimpan akan dipakai otomatis.</p>
        )}
        {component.displayName && (
          <p className="mt-1 text-xs text-[#6b7280]">Terhubung sebagai <span className="font-medium text-[#111827]">{component.displayName}</span></p>
        )}
        {component.devModeOtp && (
          <p className="mt-2 rounded-xl bg-[#eef6dd] px-3 py-2 text-xs font-medium text-[#3d5a13]" data-testid="otp-dev-code">Mode pengembangan — kode: <span className="font-mono font-bold">{component.devModeOtp}</span></p>
        )}
      </div>

      {component.otpSent && (
        <div className="mt-3 flex gap-2">
          <input
            data-testid="otp-code-input"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Kode 6 digit"
            inputMode="numeric"
            maxLength={6}
            className={`${inputClass} flex-1`}
          />
          <button data-testid="otp-verify-button" type="button" disabled={verifying || code.trim().length !== 6} onClick={handleVerify} className={primaryButtonClass}>
            {verifying ? 'Cek...' : 'Verifikasi'}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-[#dc2626]" data-testid="otp-error">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#9ca3af]">
        <span>
          {component.otpSent && secondsLeft > 0 ? `Kode berlaku ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}` : 'Kode berlaku 5 menit.'}
        </span>
        <button
          type="button"
          data-testid="otp-resend-button"
          onClick={() => onSend?.('kirim ulang')}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium text-[#c55a2b] transition hover:bg-[#fdf0e5]"
        >
          <RefreshCcw size={12} /> Kirim ulang kode
        </button>
      </div>
    </div>
  );
}