'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { ArrowRight, MapPin, PencilLine, Save, ShoppingBag, Trash2, UserRound } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';

type PortalData = {
  anonymousLabel?: string | null;
  profile: { id: string; nama: string | null; phone: string | null; email: string | null } | null;
  addresses: Array<{
    id: number;
    label: string | null;
    recipientName: string | null;
    phone: string | null;
    addressText: string;
    landmark: string | null;
    courierNote: string | null;
    latitude: string | null;
    longitude: string | null;
    isDefault: number;
    updatedAt: string;
  }>;
  orders: Array<{
    idTransaksi: string;
    kodePesanan: string | null;
    totalBayar: number;
    statusPembayaran: string;
    paymentStatus: string;
    orderStatus: string;
    paymentMethod: string | null;
    namaPenerima: string | null;
    phonePenerima: string | null;
    alamatPenerima: string | null;
    waktuSimpan: string;
    updatedAt: string;
    statusToken: string | null;
  }>;
};

const emptyAddress = {
  id: undefined as number | undefined,
  label: 'Alamat',
  recipientName: '',
  phone: '',
  addressText: '',
  landmark: '',
  courierNote: '',
  latitude: '',
  longitude: '',
  isDefault: false,
};

export default function PesananSayaPage() {
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingProfile, startSavingProfile] = useTransition();
  const [savingAddress, startSavingAddress] = useTransition();
  const [profileForm, setProfileForm] = useState({ nama: '', phone: '', email: '' });
  const [addressForm, setAddressForm] = useState(emptyAddress);

  const hasOrders = (data?.orders.length || 0) > 0;

  async function loadPortal() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/public/me', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Pesanan saya belum bisa dimuat.');
      setData(result);
      setProfileForm({
        nama: result.profile?.nama || '',
        phone: result.profile?.phone || '',
        email: result.profile?.email || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pesanan saya belum bisa dimuat.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPortal().catch(() => undefined);
  }, []);

  const latestOrder = useMemo(() => data?.orders[0] || null, [data]);

  async function saveProfile() {
    startSavingProfile(async () => {
      try {
        const response = await fetch('/api/public/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profileForm),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.ok) throw new Error(result?.error || 'Profil belum berhasil disimpan.');
        await loadPortal();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Profil belum berhasil disimpan.');
      }
    });
  }

  async function saveAddress() {
    startSavingAddress(async () => {
      try {
        const response = await fetch('/api/public/me', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(addressForm),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.ok) throw new Error(result?.error || 'Alamat belum berhasil disimpan.');
        setAddressForm(emptyAddress);
        await loadPortal();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Alamat belum berhasil disimpan.');
      }
    });
  }

  async function deleteAddress(addressId: number) {
    try {
      const response = await fetch('/api/public/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressId }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.error || 'Alamat belum berhasil dihapus.');
      await loadPortal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Alamat belum berhasil dihapus.');
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(240,180,41,0.16),transparent_25%),radial-gradient(circle_at_82%_18%,rgba(127,159,62,0.10),transparent_20%),linear-gradient(180deg,#faf6ef_0%,#fffaf4_100%)] px-5 py-8 text-[#2f241c]">
      <section className="mx-auto max-w-6xl rounded-[2rem] border border-[#f0dfca] bg-[rgba(255,250,244,0.92)] p-6 shadow-[0_18px_46px_rgba(47,36,28,0.07)] backdrop-blur-xl md:p-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-[#9a8672]">Pesanan saya</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] md:text-5xl">Semua pesanan dan alamatmu ada di sini.</h1>
            <p className="mt-3 max-w-2xl text-[#6f5d4f]">
              Tidak perlu input kode pesanan lagi. Kalau sesi pelangganmu masih sama, pesanan, alamat, dan profil ringan akan muncul otomatis di halaman ini.
            </p>
          </div>
          <Link href="/pesan" className="inline-flex items-center gap-2 rounded-full bg-[#c55a2b] px-5 py-3 font-medium text-white shadow-[0_14px_30px_rgba(197,90,43,0.16)] transition hover:bg-[#ae4d23]">
            Buka chat pesan <ArrowRight size={16} />
          </Link>
        </div>

        {error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}

        {loading ? (
          <div className="mt-10 rounded-[1.5rem] border border-[#ecd8bf] bg-white p-10 text-center text-sm font-medium text-[#6f5d4f]">
            Memuat pesanan dan data pelanggan...
          </div>
        ) : (
          <>
            {!hasOrders && (
              <div className="mt-8 rounded-[1.6rem] border border-dashed border-[#ecd8bf] bg-[#fffaf3] p-8 text-center">
                <p className="text-lg font-semibold text-[#2f241c]">Belum ada pesanan yang tersimpan di sesi ini.</p>
                <p className="mt-2 text-sm leading-6 text-[#6f5d4f]">Buat pesanan baru lewat chat, lalu halaman ini akan otomatis menjadi pusat status dan data pengirimanmu.</p>
              </div>
            )}

            {latestOrder && (
              <div className="mt-8 grid gap-3 md:grid-cols-3">
                <MetricCard label="Pesanan terakhir" value={latestOrder.kodePesanan || latestOrder.idTransaksi} />
                <MetricCard label="Status order" value={humanize(latestOrder.orderStatus)} />
                <MetricCard label="Total terakhir" value={formatRupiah(latestOrder.totalBayar)} />
              </div>
            )}

            <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <section className="space-y-4">
                <div className="rounded-[1.6rem] border border-[#ecd8bf] bg-white p-5">
                  <div className="flex items-center gap-2">
                    <ShoppingBag size={18} className="text-[#c55a2b]" />
                    <h2 className="text-xl font-semibold">Daftar pesanan</h2>
                  </div>
                  <div className="mt-4 space-y-3">
                    {(data?.orders || []).map((order) => (
                      <article key={order.idTransaksi} className="rounded-[1.3rem] border border-[#f0dfca] bg-[#fffaf3] p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-lg font-semibold">{order.kodePesanan || order.idTransaksi}</p>
                            <p className="mt-1 text-sm text-[#6f5d4f]">{new Date(order.waktuSimpan).toLocaleString('id-ID')}</p>
                            <p className="mt-2 text-sm text-[#6f5d4f]">{order.alamatPenerima || 'Alamat pengiriman belum tercatat.'}</p>
                          </div>
                          <div className="text-left md:text-right">
                            <p className="text-sm font-medium text-[#7a6758]">{humanize(order.orderStatus)}</p>
                            <p className="mt-1 text-sm text-[#7a6758]">{humanize(order.statusPembayaran || order.paymentStatus)}</p>
                            <p className="mt-2 text-lg font-semibold">{formatRupiah(order.totalBayar)}</p>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link
                            href={`/pesan/status/${encodeURIComponent(order.kodePesanan || order.idTransaksi)}${order.statusToken ? `?token=${encodeURIComponent(order.statusToken)}` : ''}`}
                            className="rounded-full bg-[#2f241c] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#47382d]"
                          >
                            Lihat detail
                          </Link>
                          {order.paymentMethod !== 'cod' && order.paymentStatus !== 'verified' && (
                            <Link
                              href={`/pesan/status/${encodeURIComponent(order.kodePesanan || order.idTransaksi)}${order.statusToken ? `?token=${encodeURIComponent(order.statusToken)}` : ''}`}
                              className="rounded-full border border-[#ecd8bf] bg-white px-4 py-2 text-sm font-medium text-[#2f241c] transition hover:bg-[#f7eddf]"
                            >
                              Lanjut bayar
                            </Link>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="rounded-[1.6rem] border border-[#ecd8bf] bg-white p-5">
                  <div className="flex items-center gap-2">
                    <UserRound size={18} className="text-[#7f9f3e]" />
                    <h2 className="text-xl font-semibold">Data pelanggan</h2>
                  </div>
                  <p className="mt-2 text-sm text-[#6f5d4f]">Bisa diganti kapan saja. Chatbot juga tetap boleh dipakai untuk minta ubah data.</p>
                  <div className="mt-4 grid gap-3">
                    <input value={profileForm.nama} onChange={(event) => setProfileForm((current) => ({ ...current, nama: event.target.value }))} placeholder="Nama" className="rounded-[1.1rem] border border-[#ecd8bf] bg-[#fffaf3] px-4 py-3 text-sm outline-none focus:border-[#c55a2b]/30" />
                    <input value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Nomor HP / WA" className="rounded-[1.1rem] border border-[#ecd8bf] bg-[#fffaf3] px-4 py-3 text-sm outline-none focus:border-[#c55a2b]/30" />
                    <input value={profileForm.email} onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email opsional" className="rounded-[1.1rem] border border-[#ecd8bf] bg-[#fffaf3] px-4 py-3 text-sm outline-none focus:border-[#c55a2b]/30" />
                    <button type="button" onClick={saveProfile} disabled={savingProfile || !profileForm.nama || !profileForm.phone} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2f241c] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#47382d] disabled:opacity-60">
                      <Save size={15} /> {savingProfile ? 'Menyimpan...' : 'Simpan profil'}
                    </button>
                    {!data?.profile && (
                      <p className="text-xs text-[#8a7562]">Profil akan aktif penuh setelah order pertamamu terhubung ke sesi pelanggan ini.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-[#ecd8bf] bg-white p-5">
                  <div className="flex items-center gap-2">
                    <MapPin size={18} className="text-[#c55a2b]" />
                    <h2 className="text-xl font-semibold">Alamat tersimpan</h2>
                  </div>
                  <div className="mt-4 space-y-3">
                    {(data?.addresses || []).map((address) => (
                      <article key={address.id} className="rounded-[1.2rem] border border-[#f0dfca] bg-[#fffaf3] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{address.label || 'Alamat'}</p>
                            <p className="mt-1 text-sm text-[#6f5d4f]">{address.recipientName || '-'} • {address.phone || '-'}</p>
                            <p className="mt-2 text-sm leading-6 text-[#6f5d4f]">{address.addressText}</p>
                            {address.isDefault ? <p className="mt-2 text-xs font-medium text-[#56721f]">Alamat default</p> : null}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setAddressForm({
                                id: address.id,
                                label: address.label || 'Alamat',
                                recipientName: address.recipientName || '',
                                phone: address.phone || '',
                                addressText: address.addressText,
                                landmark: address.landmark || '',
                                courierNote: address.courierNote || '',
                                latitude: address.latitude || '',
                                longitude: address.longitude || '',
                                isDefault: Boolean(address.isDefault),
                              })}
                              className="rounded-full border border-[#ecd8bf] bg-white px-3 py-2 text-sm font-medium text-[#2f241c]"
                            >
                              <PencilLine size={14} />
                            </button>
                            <button type="button" onClick={() => deleteAddress(address.id)} className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="mt-5 grid gap-3 rounded-[1.3rem] border border-dashed border-[#ecd8bf] bg-[#fffaf3] p-4">
                    <p className="font-semibold text-[#2f241c]">{addressForm.id ? 'Edit alamat' : 'Tambah alamat baru'}</p>
                    <input value={addressForm.label} onChange={(event) => setAddressForm((current) => ({ ...current, label: event.target.value }))} placeholder="Label alamat" className="rounded-[1.1rem] border border-[#ecd8bf] bg-white px-4 py-3 text-sm outline-none focus:border-[#c55a2b]/30" />
                    <input value={addressForm.recipientName} onChange={(event) => setAddressForm((current) => ({ ...current, recipientName: event.target.value }))} placeholder="Nama penerima" className="rounded-[1.1rem] border border-[#ecd8bf] bg-white px-4 py-3 text-sm outline-none focus:border-[#c55a2b]/30" />
                    <input value={addressForm.phone} onChange={(event) => setAddressForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Nomor penerima" className="rounded-[1.1rem] border border-[#ecd8bf] bg-white px-4 py-3 text-sm outline-none focus:border-[#c55a2b]/30" />
                    <textarea value={addressForm.addressText} onChange={(event) => setAddressForm((current) => ({ ...current, addressText: event.target.value }))} placeholder="Alamat lengkap" className="min-h-24 rounded-[1.1rem] border border-[#ecd8bf] bg-white px-4 py-3 text-sm outline-none focus:border-[#c55a2b]/30" />
                    <input value={addressForm.landmark} onChange={(event) => setAddressForm((current) => ({ ...current, landmark: event.target.value }))} placeholder="Patokan" className="rounded-[1.1rem] border border-[#ecd8bf] bg-white px-4 py-3 text-sm outline-none focus:border-[#c55a2b]/30" />
                    <input value={addressForm.courierNote} onChange={(event) => setAddressForm((current) => ({ ...current, courierNote: event.target.value }))} placeholder="Catatan kurir" className="rounded-[1.1rem] border border-[#ecd8bf] bg-white px-4 py-3 text-sm outline-none focus:border-[#c55a2b]/30" />
                    <label className="flex items-center gap-2 text-sm text-[#6f5d4f]">
                      <input type="checkbox" checked={addressForm.isDefault} onChange={(event) => setAddressForm((current) => ({ ...current, isDefault: event.target.checked }))} />
                      Jadikan alamat default
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={saveAddress} disabled={savingAddress || !addressForm.recipientName || !addressForm.phone || !addressForm.addressText} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#c55a2b] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#ae4d23] disabled:opacity-60">
                        <Save size={15} /> {savingAddress ? 'Menyimpan...' : addressForm.id ? 'Update alamat' : 'Tambah alamat'}
                      </button>
                      {addressForm.id && (
                        <button type="button" onClick={() => setAddressForm(emptyAddress)} className="rounded-full border border-[#ecd8bf] bg-white px-4 py-3 text-sm font-medium text-[#2f241c]">
                          Batal edit
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] bg-[linear-gradient(135deg,#2f241c_0%,#4b382d_100%)] p-5 text-white shadow-[0_14px_30px_rgba(47,36,28,0.14)]">
      <p className="text-sm text-white/60">{label}</p>
      <p className="mt-2 break-words text-xl font-semibold">{value}</p>
    </div>
  );
}

function humanize(value: string | null | undefined) {
  if (!value) return '-';
  return value.replace(/_/g, ' ');
}
