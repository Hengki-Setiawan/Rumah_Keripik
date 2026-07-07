'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const rawCallbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const callbackUrl = rawCallbackUrl.startsWith('/') && !rawCallbackUrl.startsWith('//')
    ? rawCallbackUrl
    : '/dashboard';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (!result?.ok) {
        setError('Username atau password salah');
        setLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(214,162,74,0.18),transparent_32%),linear-gradient(135deg,#f7f0e4_0%,#f3ebdc_52%,#eef1e6_100%)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#6b4423] text-white shadow-[0_16px_40px_rgba(107,68,35,0.18)]">
            <span className="text-base font-semibold tracking-[0.08em]">RK</span>
          </div>
          <h1 className="text-3xl font-bold text-[#2f241c]">Rumah Keripik</h1>
          <p className="mt-2 text-[#6b5a4d]">Login admin untuk operasional dan monitoring pesanan</p>
        </div>

        <div className="rounded-[1.75rem] border border-[#e8dcc9] bg-[#fff9f1]/95 p-8 shadow-[0_24px_70px_rgba(47,36,28,0.10)] backdrop-blur">
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-medium text-[#4e3f32]">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className="w-full rounded-2xl border border-[#d9ccb9] bg-white px-4 py-3 text-[#2f241c] outline-none transition focus:border-[#6f8a3a] focus:ring-2 focus:ring-[#6f8a3a]/15 disabled:bg-[#f4ede3]"
                placeholder="Masukkan username"
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-[#4e3f32]">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full rounded-2xl border border-[#d9ccb9] bg-white px-4 py-3 text-[#2f241c] outline-none transition focus:border-[#6f8a3a] focus:ring-2 focus:ring-[#6f8a3a]/15 disabled:bg-[#f4ede3]"
                placeholder="Masukkan password"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[#6b4423] px-4 py-3 font-medium text-white transition-colors duration-200 hover:bg-[#7d5230] disabled:bg-[#b8ab97]"
            >
              {loading ? 'Memproses...' : 'Masuk ke Dashboard'}
            </button>
          </form>

          <div className="mt-6 rounded-2xl border border-[#dbe4c7] bg-[#f4f8ea] p-4">
            <p className="flex items-start gap-2 text-xs text-[#4f6a2f]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              Halaman ini hanya untuk admin operasional Rumah Keripik. Gunakan kredensial yang sudah dikonfigurasi di environment deployment.
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-[#7a6a5a]">(c) 2026 Rumah Keripik. All rights reserved.</p>
      </div>
    </div>
  );
}
