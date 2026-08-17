'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Loader2, MapPin, Pencil, Plus, Trash2, User } from 'lucide-react';

type ProfileData = {
  profile: { id: string; nama: string | null; phone: string | null; email: string | null } | null;
  addresses: AddressItem[];
};

type AddressItem = {
  id: number;
  label: string | null;
  recipientName: string | null;
  phone: string | null;
  addressText: string;
  landmark: string | null;
  isDefault: number;
};

type ProfileForm = { nama: string; phone: string; email: string };
type AddressForm = { id: number | null; label: string; recipientName: string; phone: string; addressText: string; landmark: string; isDefault: boolean };

const EMPTY_ADDRESS: AddressForm = { id: null, label: 'Rumah', recipientName: '', phone: '', addressText: '', landmark: '', isDefault: false };

export default function ProfilPelangganPage() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);

  const [profileForm, setProfileForm] = useState<ProfileForm>({ nama: '', phone: '', email: '' });
  const [editingAddress, setEditingAddress] = useState<AddressForm | null>(null);
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressError, setAddressError] = useState('');

  const loadMe = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/public/me', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Profil belum bisa dimuat.');
      setData(result);
      setProfileForm({ nama: result.profile?.nama || '', phone: result.profile?.phone || '', email: result.profile?.email || '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profil belum bisa dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe().catch(() => undefined);
  }, [loadMe]);

  async function saveProfile() {
    setSaving(true);
    setError('');
    setSavedBanner(false);
    try {
      const response = await fetch('/api/public/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama: profileForm.nama, phone: profileForm.phone, email: profileForm.email }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Profil gagal disimpan.');
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profil gagal disimpan.');
    } finally {
      setSaving(false);
    }
  }

  async function saveAddress() {
    if (!editingAddress) return;
    if (!editingAddress.addressText.trim()) {
      setAddressError('Alamat wajib diisi.');
      return;
    }
    setAddressSaving(true);
    setAddressError('');
    try {
      const response = await fetch('/api/public/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingAddress),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Alamat gagal disimpan.');
      setEditingAddress(null);
      await loadMe();
    } catch (err) {
      setAddressError(err instanceof Error ? err.message : 'Alamat gagal disimpan.');
    } finally {
      setAddressSaving(false);
    }
  }

  async function removeAddress(id: number) {
    if (!window.confirm('Hapus alamat ini?')) return;
    setAddressError('');
    try {
      const response = await fetch('/api/public/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressId: id }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Alamat gagal dihapus.');
      if (editingAddress?.id === id) setEditingAddress(null);
      await loadMe();
    } catch (err) {
      setAddressError(err instanceof Error ? err.message : 'Alamat gagal dihapus.');
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(240,180,41,0.16),transparent_25%),radial-gradient(circle_at_82%_18%,rgba(127,159,62,0.10),transparent_20%),linear-gradient(180deg,#faf6ef_0%,#fffaf4_100%)] px-5 py-8 text-[#2f241c]">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-[#f0dfca] bg-[rgba(255,250,244,0.92)] p-6 text-center text-sm font-medium text-[#6f5d4f] md:p-10">Memuat profil...</section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(240,180,41,0.16),transparent_25%),radial-gradient(circle_at_82%_18%,rgba(127,159,62,0.10),transparent_20%),linear-gradient(180deg,#faf6ef_0%,#fffaf4_100%)] px-5 py-8 text-[#2f241c]">
      <section className="mx-auto max-w-3xl rounded-[2rem] border border-[#f0dfca] bg-[rgba(255,250,244,0.92)] p-6 shadow-[0_18px_46px_rgba(47,36,28,0.07)] backdrop-blur-xl md:p-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-[#9a8672]">Profil pelanggan</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] md:text-4xl">Data pesananmu, sekali terhubung.</h1>
            <p className="mt-3 max-w-xl text-[#6f5d4f]">
              {data?.profile
                ? 'Ubah nama, nomor, atau alamatmu di sini. Perubahan otomatis dipakai untuk pesanan berikutnya.'
                : 'Verifikasi nomor WhatsApp dulu lewat chat untuk mengelola profil dan alamatmu.'}
            </p>
          </div>
          <Link href="/pesan/saya" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#ecd8bf] bg-white px-4 py-2 text-sm font-medium text-[#5f4d3f] transition hover:bg-[#f7eddf]">
            Kembali ke pesanan
          </Link>
        </div>

        {error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
        {savedBanner && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">Profil berhasil disimpan.</div>}

        {!data?.profile ? (
          <div className="mt-8 rounded-[1.6rem] border border-dashed border-[#ecd8bf] bg-[#fffaf3] p-8 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#c55a2b]/10 text-[#c55a2b]">
              <User size={22} />
            </div>
            <p className="mt-3 text-lg font-semibold text-[#2f241c]">Profilmu belum terhubung.</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6f5d4f]">
              Verifikasi nomor WhatsApp lewat chat. Setelah itu nama, nomor, dan alamatmu otomatis muncul di sini.
            </p>
            <Link
              href="/pesan?verify=profil"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#c55a2b] px-5 py-2.5 font-medium text-white transition hover:bg-[#ae4d23]"
            >
              Verifikasi WhatsApp <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <>
            <section className="mt-8" data-testid="profil-form">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <User size={17} className="text-[#c55a2b]" /> Data diri
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-[#6f5d4f]">Nama</span>
                  <input
                    type="text"
                    value={profileForm.nama}
                    onChange={(e) => setProfileForm({ ...profileForm, nama: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-[#ecd8bf] bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#c55a2b] focus:ring-2 focus:ring-[#c55a2b]/20"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-[#6f5d4f]">Nomor WhatsApp</span>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-[#ecd8bf] bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#c55a2b] focus:ring-2 focus:ring-[#c55a2b]/20"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-sm font-medium text-[#6f5d4f]">Email (opsional)</span>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-[#ecd8bf] bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#c55a2b] focus:ring-2 focus:ring-[#c55a2b]/20"
                  />
                </label>
              </div>
              <button
                type="button"
                data-testid="profil-save-button"
                onClick={saveProfile}
                disabled={saving}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#c55a2b] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#ae4d23] disabled:opacity-60"
              >
                {saving && <Loader2 size={15} className="animate-spin" />} Simpan profil
              </button>
            </section>

            <section className="mt-10" data-testid="address-list">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <MapPin size={17} className="text-[#c55a2b]" /> Alamat tersimpan
                </h2>
                <button
                  type="button"
                  data-testid="address-add-button"
                  onClick={() => setEditingAddress({ ...EMPTY_ADDRESS })}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#ecd8bf] bg-white px-4 py-2 text-sm font-medium text-[#5f4d3f] transition hover:bg-[#f7eddf]"
                >
                  <Plus size={14} /> Tambah alamat
                </button>
              </div>

              {data.addresses.length === 0 && (
                <p className="mt-4 rounded-2xl border border-dashed border-[#ecd8bf] bg-[#fffaf3] p-5 text-sm text-[#6f5d4f]">Belum ada alamat tersimpan.</p>
              )}

              <div className="mt-4 space-y-3">
                {data.addresses.map((address) => (
                  <article key={address.id} className="rounded-[1.3rem] border border-[#f0dfca] bg-[#fffaf3] p-4" data-testid="address-card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {address.label || 'Alamat'}
                          {address.isDefault === 1 && <span className="ml-2 rounded-full bg-[#7f9f3e]/15 px-2 py-0.5 text-[11px] font-semibold text-[#3d5a13]">Utama</span>}
                        </p>
                        <p className="mt-1 text-sm text-[#6f5d4f]">{address.recipientName || '-'} · {address.phone || '-'}</p>
                        <p className="mt-1 text-sm leading-6 text-[#6f5d4f]">{address.addressText}</p>
                        {address.landmark && <p className="mt-1 text-xs text-[#9b8772]">Patokan: {address.landmark}</p>}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingAddress({
                              id: address.id,
                              label: address.label || '',
                              recipientName: address.recipientName || '',
                              phone: address.phone || '',
                              addressText: address.addressText,
                              landmark: address.landmark || '',
                              isDefault: address.isDefault === 1,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-full border border-[#ecd8bf] bg-white px-3 py-1.5 text-xs font-medium text-[#5f4d3f] transition hover:bg-[#f7eddf]"
                        >
                          <Pencil size={12} /> Ubah
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAddress(address.id)}
                          className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
                        >
                          <Trash2 size={12} /> Hapus
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {editingAddress && (
              <section className="mt-8 rounded-[1.5rem] border border-[#f0dfca] bg-[#fffaf3] p-5" data-testid="address-form">
                <h3 className="font-semibold">{editingAddress.id ? 'Ubah alamat' : 'Tambah alamat'}</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-medium text-[#6f5d4f]">Label</span>
                    <input
                      type="text"
                      value={editingAddress.label}
                      onChange={(e) => setEditingAddress({ ...editingAddress, label: e.target.value })}
                      placeholder="Rumah / Kantor"
                      className="mt-1 w-full rounded-xl border border-[#ecd8bf] bg-white px-3 py-2 text-sm outline-none focus:border-[#c55a2b]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-[#6f5d4f]">Nama penerima</span>
                    <input
                      type="text"
                      value={editingAddress.recipientName}
                      onChange={(e) => setEditingAddress({ ...editingAddress, recipientName: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-[#ecd8bf] bg-white px-3 py-2 text-sm outline-none focus:border-[#c55a2b]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-[#6f5d4f]">No. HP penerima</span>
                    <input
                      type="tel"
                      value={editingAddress.phone}
                      onChange={(e) => setEditingAddress({ ...editingAddress, phone: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-[#ecd8bf] bg-white px-3 py-2 text-sm outline-none focus:border-[#c55a2b]"
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-xs font-medium text-[#6f5d4f]">Alamat lengkap</span>
                    <textarea
                      rows={3}
                      value={editingAddress.addressText}
                      onChange={(e) => setEditingAddress({ ...editingAddress, addressText: e.target.value })}
                      className="mt-1 w-full resize-none rounded-xl border border-[#ecd8bf] bg-white px-3 py-2 text-sm outline-none focus:border-[#c55a2b]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-[#6f5d4f]">Patokan / landmark</span>
                    <input
                      type="text"
                      value={editingAddress.landmark}
                      onChange={(e) => setEditingAddress({ ...editingAddress, landmark: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-[#ecd8bf] bg-white px-3 py-2 text-sm outline-none focus:border-[#c55a2b]"
                    />
                  </label>
                  <label className="flex items-end gap-2 pb-2">
                    <input
                      type="checkbox"
                      checked={editingAddress.isDefault}
                      onChange={(e) => setEditingAddress({ ...editingAddress, isDefault: e.target.checked })}
                      className="h-4 w-4 accent-[#c55a2b]"
                    />
                    <span className="text-sm text-[#6f5d4f]">Jadikan alamat utama</span>
                  </label>
                </div>
                {addressError && <p className="mt-3 text-sm font-medium text-red-700">{addressError}</p>}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    data-testid="address-save-button"
                    onClick={saveAddress}
                    disabled={addressSaving}
                    className="inline-flex items-center gap-2 rounded-full bg-[#c55a2b] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#ae4d23] disabled:opacity-60"
                  >
                    {addressSaving && <Loader2 size={15} className="animate-spin" />} Simpan alamat
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAddress(null);
                      setAddressError('');
                    }}
                    className="rounded-full border border-[#ecd8bf] bg-white px-5 py-2.5 text-sm font-medium text-[#5f4d3f] transition hover:bg-[#f7eddf]"
                  >
                    Batal
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}
