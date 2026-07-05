'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  Bot,
  CheckCircle2,
  ChevronRight,
  Loader2,
  LocateFixed,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
} from 'lucide-react';
import { formatRupiah } from '@/lib/utils';

export type OrderProduct = {
  id_produk: string;
  nama_produk: string;
  deskripsi: string | null;
  harga_jual: number;
  stok_gudang_utama: number;
  image_url?: string | null;
  kategori_id?: string | null;
  kategori_nama?: string | null;
  variants?: Array<{ id_varian: string; nama_varian: string; harga_jual: number; stok: number; image_url?: string | null }>;
};

type CartItem = {
  id_produk: string;
  id_varian?: string;
  qty: number;
};

type PaymentMethod = {
  id: string;
  type: 'bank_transfer' | 'qris' | 'ewallet' | 'cod';
  label: string;
  accountName: string | null;
  accountNumber: string | null;
  bankName: string | null;
  qrisImageUrl: string | null;
  note: string | null;
  minOrderTotal?: number | null;
  maxOrderTotal?: number | null;
};

type SavedAddress = {
  id: number;
  recipientName: string | null;
  phone: string | null;
  addressText: string;
  landmark: string | null;
  courierNote: string | null;
  latitude: string | null;
  longitude: string | null;
};

type Props = {
  products: OrderProduct[];
  categories?: Array<{ id: string; name: string }>;
  paymentMethods?: PaymentMethod[];
  quickPrompts?: string[];
  source?: string;
  chatId?: string;
};

const fallbackQuickPrompts = [
  'Paket hemat 50 ribu',
  'Yang pedas favorit',
  'Cocok buat oleh-oleh',
  'Untuk anak-anak',
];

function extractCoordsFromMapsLink(value: string) {
  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&]query=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1] && match?.[2]) {
      return { lat: match[1], lng: match[2] };
    }
  }

  return null;
}

export function WebOrderApp({ products, categories = [], paymentMethods = [], quickPrompts = fallbackQuickPrompts, source = 'web', chatId }: Props) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [customer, setCustomer] = useState({ name: '', phone: '', type: 'konsumen' });
  const [address, setAddress] = useState({ text: '', note: '', mapsLink: '', lat: '', lng: '' });
  const firstPayment = paymentMethods[0];
  const [paymentMethodId, setPaymentMethodId] = useState(firstPayment?.id || '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [helperText, setHelperText] = useState('Ceritakan seleramu, nanti aku bantu pilihkan varian yang cocok.');
  const [assistantText, setAssistantText] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function ensureSession() {
      try {
        const response = await fetch('/api/public/session', { method: 'POST' });
        if (!response.ok || cancelled) return;
        const result = await response.json();
        const message = result?.responses?.[0]?.message;
        if (typeof message === 'string') setHelperText(message);
      } catch {
        // Existing order form remains usable if session bootstrap fails.
      }
    }

    ensureSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadSavedAddresses() {
      try {
        const response = await fetch('/api/public/saved-addresses');
        if (!response.ok || cancelled) return;
        const result = await response.json();
        if (Array.isArray(result.addresses)) setSavedAddresses(result.addresses);
      } catch {
        // Saved address is optional; manual address remains the primary path.
      }
    }
    loadSavedAddresses();
    return () => { cancelled = true; };
  }, []);

  const activeProducts = products.filter((product) => product.stok_gudang_utama > 0 || (product.variants || []).some((variant) => variant.stok > 0));
  const visibleProducts = selectedCategory === 'all' ? products : products.filter((product) => product.kategori_id === selectedCategory);
  const cartDetails = cart
    .map((item) => {
      const product = products.find((entry) => entry.id_produk === item.id_produk);
      if (!product) return null;
      const variant = product.variants?.find((entry) => entry.id_varian === item.id_varian) || null;
      const unitPrice = variant?.harga_jual ?? product.harga_jual;
      return { ...item, product, variant, unitPrice, subtotal: unitPrice * item.qty };
    })
    .filter(Boolean) as Array<CartItem & { product: OrderProduct; variant: NonNullable<OrderProduct['variants']>[number] | null; unitPrice: number; subtotal: number }>;
  const total = cartDetails.reduce((sum, item) => sum + item.subtotal, 0);
  const totalQty = cartDetails.reduce((sum, item) => sum + item.qty, 0);

  useEffect(() => {
    if (!paymentMethods.length) return;
    const current = paymentMethods.find((method) => method.id === paymentMethodId);
    const isInvalid = current && ((current.minOrderTotal != null && total < current.minOrderTotal) || (current.maxOrderTotal != null && total > current.maxOrderTotal));
    if (!current || isInvalid) {
      const fallback = paymentMethods.find((method) => (method.minOrderTotal == null || total >= method.minOrderTotal) && (method.maxOrderTotal == null || total <= method.maxOrderTotal));
      if (fallback) setPaymentMethodId(fallback.id);
    }
  }, [paymentMethodId, paymentMethods, total]);

  function getQty(id: string, variantId?: string) {
    return cart.find((item) => item.id_produk === id && item.id_varian === variantId)?.qty || 0;
  }

  function addToCart(id: string, variantId?: string) {
    const product = products.find((entry) => entry.id_produk === id);
    if (!product) return;
    const variant = product.variants?.find((entry) => entry.id_varian === variantId);
    if ((product.variants?.length || 0) > 0 && !variant) return;
    const maxStock = variant ? variant.stok : product.stok_gudang_utama;
    if (maxStock <= 0) return;

    setCart((current) => {
      const existing = current.find((item) => item.id_produk === id && item.id_varian === variantId);
      if (!existing) return [...current, { id_produk: id, id_varian: variantId, qty: 1 }];
      if (existing.qty >= maxStock) return current;
      return current.map((item) => item.id_produk === id && item.id_varian === variantId ? { ...item, qty: item.qty + 1 } : item);
    });
  }

  function removeFromCart(id: string, variantId?: string) {
    setCart((current) => {
      const existing = current.find((item) => item.id_produk === id && item.id_varian === variantId);
      if (!existing) return current;
      if (existing.qty <= 1) return current.filter((item) => !(item.id_produk === id && item.id_varian === variantId));
      return current.map((item) => item.id_produk === id && item.id_varian === variantId ? { ...item, qty: item.qty - 1 } : item);
    });
  }

  function applyPrompt(prompt: string) {
    const lower = prompt.toLowerCase();
    const candidates = activeProducts.filter((product) => {
      const haystack = `${product.nama_produk} ${product.deskripsi || ''}`.toLowerCase();
      if (lower.includes('pedas')) return haystack.includes('pedas');
      if (lower.includes('anak')) return !haystack.includes('pedas');
      if (lower.includes('oleh')) return true;
      return true;
    });

    const selected = candidates.slice(0, lower.includes('hemat') ? 2 : 1);
    selected.forEach((product) => addToCart(product.id_produk, product.variants?.[0]?.id_varian));
    setHelperText(
      selected.length > 0
        ? `Aku tambahkan ${selected.map((item) => item.nama_produk).join(', ')} ke keranjang. Kamu masih bisa ubah qty.`
        : 'Belum ada produk yang cocok dari stok aktif. Coba pilih manual dulu ya.'
    );
  }

  async function askAssistant() {
    if (!assistantText.trim()) return;
    setAssistantLoading(true);
    try {
      const res = await fetch('/api/public/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: assistantText }) });
      const data = await res.json();
      setHelperText(data.answer || data.error || 'Asisten belum bisa menjawab.');
    } catch {
      setHelperText('Asisten sedang tidak tersedia. Kamu tetap bisa lanjut pilih produk secara manual.');
    } finally {
      setAssistantLoading(false);
      setAssistantText('');
    }
  }

  function useBrowserLocation() {
    if (!navigator.geolocation) {
      setError('Browser ini belum mendukung ambil lokasi otomatis.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setAddress((current) => ({
          ...current,
          lat: String(position.coords.latitude),
          lng: String(position.coords.longitude),
        }));
        setError('');
      },
      () => setError('Lokasi belum diizinkan. Kamu tetap bisa isi alamat manual.'),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  function updateMapsLink(value: string) {
    const coords = extractCoordsFromMapsLink(value);
    setAddress((current) => ({
      ...current,
      mapsLink: value,
      lat: coords?.lat || current.lat,
      lng: coords?.lng || current.lng,
    }));
  }

  function canContinueToData() {
    return cartDetails.length > 0;
  }

  function canSubmit() {
    return (
      cartDetails.length > 0 &&
      paymentMethodId.trim().length > 0 &&
      customer.name.trim().length >= 2 &&
      customer.phone.trim().length >= 8 &&
      address.text.trim().length >= 8
    );
  }

  async function submitOrder() {
    setError('');

    if (!canSubmit()) {
      setError('Lengkapi nama, nomor kontak, alamat, metode pembayaran, dan minimal 1 produk dulu ya.');
      return;
    }

    startTransition(async () => {
      const response = await fetch('/api/order/web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: source === 'telegram' ? 'telegram' : 'web',
          chatId,
          customer,
          address,
          paymentMethodId,
          notes,
          items: cartDetails.map((item) => ({ id_produk: item.id_produk, id_varian: item.id_varian, qty: item.qty })),
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setError(result.error || 'Pesanan belum bisa dibuat. Coba cek datanya lagi.');
        return;
      }

      const tokenQuery = result.order.statusToken ? `?token=${encodeURIComponent(result.order.statusToken)}` : '';
      window.location.href = `/pesan/sukses/${encodeURIComponent(result.order.kodePesanan)}${tokenQuery}`;
    });
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#fff7df] text-[#241306]">
      <section className="relative px-5 pb-28 pt-6 md:px-10 lg:px-16">
        <div className="absolute inset-0 -z-0 bg-[radial-gradient(circle_at_15%_15%,rgba(245,158,11,0.28),transparent_28%),radial-gradient(circle_at_85%_5%,rgba(34,197,94,0.20),transparent_24%),linear-gradient(135deg,#fff8df_0%,#fff1c4_45%,#f6df9d_100%)]" />
        <div className="absolute right-8 top-20 -z-0 h-48 w-48 rounded-full bg-[#c2410c]/10 blur-3xl" />

        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between rounded-full border border-[#e8c98d] bg-white/70 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-[#8d4b00] text-lg font-black text-white">RK</div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-[#8d4b00]">Rumah Keripik</p>
              <p className="text-xs text-[#6b4a2e]">Pesan cepat, admin langsung cek</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full bg-[#1f7a3d]/10 px-4 py-2 text-sm font-bold text-[#1f7a3d] md:flex">
            <CheckCircle2 size={16} />
            Stok dari dashboard
          </div>
        </header>

        <div className="relative z-10 mx-auto mt-10 grid max-w-7xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="space-y-7">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#e5bf7b] bg-white/70 px-4 py-2 text-sm font-bold text-[#8d4b00]">
                <Sparkles size={16} />
                Mini web pemesanan baru
              </div>
              <h1 className="text-4xl font-black leading-tight tracking-[-0.04em] text-[#2a1606] md:text-6xl">
                Pilih keripik, isi alamat, admin langsung proses.
              </h1>
              <p className="mt-5 text-lg leading-8 text-[#654327]">
                Form ini dibuat singkat supaya kamu tidak perlu chat panjang. Pesanan masuk ke dashboard Rumah Keripik dan statusnya bisa dilacak.
              </p>
            </div>

            <div className="rounded-[2rem] border border-[#e7c88c] bg-white/75 p-5 shadow-xl shadow-[#8d4b00]/10 backdrop-blur">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#123524] text-white">
                  <Bot size={20} />
                </div>
                <div>
                  <p className="font-black">AI Concierge Hemat</p>
                  <p className="text-sm text-[#735033]">{helperText}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => applyPrompt(prompt)}
                    className="rounded-full border border-[#e0bd82] bg-[#fff9ec] px-4 py-2 text-sm font-bold text-[#7a3f00] transition hover:-translate-y-0.5 hover:bg-[#ffe1aa]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
                <input value={assistantText} onChange={(event) => setAssistantText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') askAssistant(); }} placeholder="Tanya asisten: pembayaran, rasa, COD, pengiriman..." className="rounded-2xl border border-[#e0bd82] bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#8d4b00]" />
                <button type="button" onClick={askAssistant} disabled={assistantLoading} className="rounded-2xl bg-[#123524] px-5 py-3 text-sm font-black text-white disabled:opacity-60">{assistantLoading ? 'Menjawab...' : 'Tanya'}</button>
              </div>
            </div>

            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setSelectedCategory('all')} className={`rounded-full px-4 py-2 text-sm font-black ${selectedCategory === 'all' ? 'bg-[#2a1606] text-white' : 'border border-[#e0bd82] bg-white/80 text-[#7a3f00]'}`}>Semua</button>
                {categories.map((category) => (
                  <button key={category.id} type="button" onClick={() => setSelectedCategory(category.id)} className={`rounded-full px-4 py-2 text-sm font-black ${selectedCategory === category.id ? 'bg-[#2a1606] text-white' : 'border border-[#e0bd82] bg-white/80 text-[#7a3f00]'}`}>{category.name}</button>
                ))}
              </div>
            )}

            <section className="grid gap-4 sm:grid-cols-2">
              {visibleProducts.map((product) => {
                const selectedVariantId = selectedVariants[product.id_produk] || product.variants?.[0]?.id_varian;
                const primaryVariant = product.variants?.find((variant) => variant.id_varian === selectedVariantId) || product.variants?.[0];
                const qty = getQty(product.id_produk, selectedVariantId);
                const displayPrice = primaryVariant?.harga_jual ?? product.harga_jual;
                const displayStock = primaryVariant?.stok ?? product.stok_gudang_utama;
                const soldOut = displayStock <= 0;
                const imageUrl = primaryVariant?.image_url || product.image_url;

                return (
                  <article
                    key={product.id_produk}
                    className="group rounded-[1.8rem] border border-[#e8c98d] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-[#8d4b00]/10"
                  >
                    <div className="mb-5 flex h-40 items-center justify-center overflow-hidden rounded-[1.4rem] bg-[linear-gradient(135deg,#ffe8ad,#ffd06a)] shadow-inner">
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrl} alt={product.nama_produk} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-24 w-24 place-items-center rounded-full border-8 border-white/45 bg-[#8d4b00] text-2xl font-black text-white shadow-lg">RK</div>
                      )}
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-black text-[#2a1606]">{product.nama_produk}</h2>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#79583b]">
                          {product.deskripsi || 'Keripik renyah pilihan Rumah Keripik.'}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#fff0c2] px-3 py-1 text-xs font-black text-[#8d4b00]">
                         {product.kategori_nama || product.id_produk}
                      </span>
                    </div>
                    {product.variants && product.variants.length > 0 && (
                      <div className="mt-4 rounded-2xl bg-[#fff8e8] p-3 text-sm font-bold text-[#79583b]">
                        <p className="mb-2 text-xs uppercase tracking-widest text-[#8d4b00]">Pilih Varian</p>
                        <div className="flex flex-wrap gap-2">
                          {product.variants.map((variant) => (
                            <button
                              key={variant.id_varian}
                              type="button"
                              disabled={variant.stok <= 0}
                              onClick={() => setSelectedVariants((current) => ({ ...current, [product.id_produk]: variant.id_varian }))}
                              className={`rounded-full px-3 py-1.5 text-xs font-black ${selectedVariantId === variant.id_varian ? 'bg-[#2a1606] text-white' : 'bg-white text-[#7a3f00]'} disabled:cursor-not-allowed disabled:opacity-40`}
                            >
                              {variant.nama_varian} - {formatRupiah(variant.harga_jual)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-5 flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-black text-[#8d4b00]">{formatRupiah(displayPrice)}</p>
                        <p className={`text-sm font-bold ${soldOut ? 'text-red-600' : 'text-[#287243]'}`}>
                          {soldOut ? 'Stok habis' : `Stok ${displayStock}`}
                        </p>
                      </div>
                      {qty > 0 ? (
                        <div className="flex items-center gap-2 rounded-full bg-[#2a1606] p-1 text-white">
                          <button type="button" onClick={() => removeFromCart(product.id_produk, selectedVariantId)} className="grid h-9 w-9 place-items-center rounded-full bg-white/10">
                            <Minus size={16} />
                          </button>
                          <span className="min-w-6 text-center font-black">{qty}</span>
                          <button type="button" onClick={() => addToCart(product.id_produk, selectedVariantId)} className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#2a1606]">
                            <Plus size={16} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={soldOut}
                          onClick={() => addToCart(product.id_produk, selectedVariantId)}
                          className="rounded-full bg-[#8d4b00] px-4 py-3 text-sm font-black text-white transition hover:bg-[#6f3900] disabled:cursor-not-allowed disabled:bg-[#c9b9a3]"
                        >
                          Tambah
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          </div>

          <aside className="sticky top-5 rounded-[2rem] border border-[#e5bf7b] bg-[#fffdf6] p-5 shadow-2xl shadow-[#8d4b00]/15">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.22em] text-[#9a5b08]">Checkout</p>
                <h2 className="text-2xl font-black">Keranjang kamu</h2>
              </div>
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#8d4b00] text-white">
                <ShoppingBag />
              </div>
            </div>

            <div className="mb-5 grid grid-cols-3 gap-2 text-center text-xs font-black">
              {['Produk', 'Data', 'Bayar'].map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStep((index + 1) as 1 | 2 | 3)}
                  className={`rounded-full px-3 py-2 ${step === index + 1 ? 'bg-[#2a1606] text-white' : 'bg-[#f4e6c5] text-[#765236]'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {step === 1 && (
              <div className="space-y-4">
                {cartDetails.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-[#d7b276] bg-[#fff8e8] p-6 text-center">
                    <ShoppingBag className="mx-auto mb-3 text-[#b9781a]" />
                    <p className="font-bold text-[#735033]">Keranjang masih kosong.</p>
                    <p className="mt-1 text-sm text-[#8c6a4c]">Pilih produk dulu dari katalog.</p>
                  </div>
                ) : (
                  cartDetails.map((item) => (
                    <div key={item.id_produk} className="flex items-center justify-between gap-3 rounded-3xl bg-[#fff4d6] p-4">
                      <div>
                        <p className="font-black">{item.product.nama_produk}</p>
                        {item.variant && <p className="text-xs font-bold text-[#735033]">{item.variant.nama_varian}</p>}
                        <p className="text-sm text-[#735033]">
                          {item.qty} x {formatRupiah(item.unitPrice)}
                        </p>
                      </div>
                      <p className="font-black text-[#8d4b00]">{formatRupiah(item.subtotal)}</p>
                    </div>
                  ))
                )}
                <button
                  type="button"
                  disabled={!canContinueToData()}
                  onClick={() => setStep(2)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2a1606] px-5 py-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b9a98f]"
                >
                  Lanjut isi data <ChevronRight size={18} />
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-[#5e3d22]">Nama penerima</span>
                  <input
                    value={customer.name}
                    onChange={(event) => setCustomer({ ...customer, name: event.target.value })}
                    className="w-full rounded-2xl border border-[#dfbd83] bg-white px-4 py-3 outline-none focus:border-[#8d4b00]"
                    placeholder="Contoh: Hengki Setiawan"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-[#5e3d22]">Nomor kontak</span>
                  <input
                    value={customer.phone}
                    onChange={(event) => setCustomer({ ...customer, phone: event.target.value })}
                    className="w-full rounded-2xl border border-[#dfbd83] bg-white px-4 py-3 outline-none focus:border-[#8d4b00]"
                    placeholder="Contoh: 08123456789"
                  />
                </label>
                <div>
                  <span className="mb-2 block text-sm font-black text-[#5e3d22]">Tipe pelanggan</span>
                  <div className="grid grid-cols-3 gap-2">
                    {(['konsumen', 'warung', 'reseller'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setCustomer({ ...customer, type })}
                        className={`rounded-2xl border px-3 py-3 text-sm font-black capitalize ${customer.type === type ? 'border-[#8d4b00] bg-[#ffe2aa]' : 'border-[#dfbd83] bg-white'}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-[#5e3d22]">Alamat lengkap</span>
                  {savedAddresses.length > 0 && (
                    <div className="mb-3 space-y-2 rounded-2xl border border-[#dfbd83] bg-[#fff8e8] p-3">
                      <p className="text-xs font-black uppercase tracking-widest text-[#8d4b00]">Alamat tersimpan dari sesi ini</p>
                      {savedAddresses.map((saved) => (
                        <button
                          key={saved.id}
                          type="button"
                          onClick={() => {
                            setCustomer((current) => ({ ...current, name: saved.recipientName || current.name, phone: saved.phone || current.phone }));
                            setAddress({ text: saved.addressText, note: saved.courierNote || saved.landmark || '', mapsLink: '', lat: saved.latitude || '', lng: saved.longitude || '' });
                          }}
                          className="block w-full rounded-xl bg-white px-3 py-2 text-left text-sm font-bold text-[#735033] shadow-sm"
                        >
                          {saved.addressText}
                        </button>
                      ))}
                    </div>
                  )}
                  <textarea
                    value={address.text}
                    onChange={(event) => setAddress({ ...address, text: event.target.value })}
                    className="min-h-24 w-full rounded-2xl border border-[#dfbd83] bg-white px-4 py-3 outline-none focus:border-[#8d4b00]"
                    placeholder="Nama jalan, nomor rumah, kelurahan, kecamatan, kota"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-[#5e3d22]">Link Google Maps atau patokan</span>
                  <input
                    value={address.mapsLink}
                    onChange={(event) => updateMapsLink(event.target.value)}
                    className="w-full rounded-2xl border border-[#dfbd83] bg-white px-4 py-3 outline-none focus:border-[#8d4b00]"
                    placeholder="Tempel link maps jika ada"
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    value={address.note}
                    onChange={(event) => setAddress({ ...address, note: event.target.value })}
                    className="rounded-2xl border border-[#dfbd83] bg-white px-4 py-3 outline-none focus:border-[#8d4b00]"
                    placeholder="Patokan rumah, catatan kurir"
                  />
                  <button
                    type="button"
                    onClick={useBrowserLocation}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#123524] px-4 py-3 font-black text-white"
                  >
                    <LocateFixed size={18} /> Ambil titik
                  </button>
                </div>
                {(address.lat && address.lng) && (
                  <div className="flex items-center gap-2 rounded-2xl bg-[#e9f8dd] px-4 py-3 text-sm font-bold text-[#256f31]">
                    <MapPin size={16} />
                    Koordinat tersimpan: {address.lat.slice(0, 10)}, {address.lng.slice(0, 10)}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2a1606] px-5 py-4 font-black text-white"
                >
                  Lanjut pembayaran <ChevronRight size={18} />
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {(paymentMethods.length ? paymentMethods : []).map((method) => (
                    (() => {
                      const disabledByMin = method.minOrderTotal != null && total < method.minOrderTotal;
                      const disabledByMax = method.maxOrderTotal != null && total > method.maxOrderTotal;
                      const disabled = disabledByMin || disabledByMax;
                      return (
                    <button
                      key={method.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => setPaymentMethodId(method.id)}
                      className={`rounded-3xl border p-4 text-left ${paymentMethodId === method.id ? 'border-[#8d4b00] bg-[#ffe1aa]' : 'border-[#dfbd83] bg-white'} disabled:cursor-not-allowed disabled:opacity-45`}
                    >
                      {method.type === 'cod' ? <Truck className="mb-2" /> : <Store className="mb-2" />}
                      <p className="font-black">{method.label}</p>
                      <p className="text-xs text-[#735033]">{method.note || (method.type === 'cod' ? 'Menunggu admin setujui' : 'Admin cek bukti bayar')}</p>
                      {disabledByMin && <p className="mt-2 text-xs font-black text-red-700">Minimal {formatRupiah(method.minOrderTotal || 0)}</p>}
                      {disabledByMax && <p className="mt-2 text-xs font-black text-red-700">Maksimal {formatRupiah(method.maxOrderTotal || 0)}</p>}
                    </button>
                      );
                    })()
                  ))}
                </div>
                {paymentMethods.length === 0 && (
                  <div className="rounded-3xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                    Metode pembayaran belum dikonfigurasi admin. Tambahkan rekening/QRIS/COD di dashboard dulu.
                  </div>
                )}
                {paymentMethods.find((method) => method.id === paymentMethodId)?.qrisImageUrl && (
                  <div className="rounded-3xl border border-[#dfbd83] bg-white p-4 text-sm font-bold text-[#735033]">
                    <p className="mb-2 font-black text-[#2a1606]">QRIS statis</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={paymentMethods.find((method) => method.id === paymentMethodId)?.qrisImageUrl || ''} alt="QRIS" className="mx-auto max-h-56 rounded-2xl object-contain" />
                    <p className="mt-2">Pastikan nominal sesuai total sebelum upload bukti.</p>
                  </div>
                )}
                {(() => {
                  const method = paymentMethods.find((entry) => entry.id === paymentMethodId);
                  if (!method || method.type === 'qris' || method.type === 'cod') return null;
                  return <div className="rounded-3xl border border-[#dfbd83] bg-white p-4 text-sm text-[#735033]"><p className="font-black text-[#2a1606]">Instruksi {method.label}</p>{method.bankName && <p>Bank: {method.bankName}</p>}{method.accountNumber && <p>No: <b>{method.accountNumber}</b></p>}{method.accountName && <p>Nama: {method.accountName}</p>}</div>;
                })()}
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="min-h-20 w-full rounded-2xl border border-[#dfbd83] bg-white px-4 py-3 outline-none focus:border-[#8d4b00]"
                  placeholder="Catatan pesanan, contoh: jangan terlalu pedas"
                />
                <div className="rounded-3xl bg-[#2a1606] p-5 text-white">
                  <div className="mb-3 flex justify-between text-sm text-white/75">
                    <span>Total item</span>
                    <span>{totalQty} pcs</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="font-bold text-white/80">Total produk</span>
                    <span className="text-3xl font-black">{formatRupiah(total)}</span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-white/70">
                    Ongkir dan verifikasi final akan dikonfirmasi admin sesuai alamat pengiriman.
                  </p>
                </div>
                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                    {error}
                  </div>
                )}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={submitOrder}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#8d4b00] px-5 py-4 text-lg font-black text-white transition hover:bg-[#6f3900] disabled:cursor-wait disabled:bg-[#b9a98f]"
                >
                  {isPending ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                  Buat Pesanan
                </button>
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
