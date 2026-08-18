'use client';

import {useCallback, useEffect, useState} from 'react';
import {Bell, Bot, CheckCircle2, Loader2, RefreshCw, Send, Webhook, XCircle} from 'lucide-react';
import {useToast} from '@/components/ui/toast';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';

interface BotInfo {
  ok: boolean;
  result?: { username?: string; first_name?: string; id?: number };
}

interface WebhookInfo {
  ok: boolean;
  result?: {
    url?: string;
    pending_update_count?: number;
    last_error_message?: string;
    last_error_date?: number;
    allowed_updates?: string[];
  };
}

interface StatusData {
  ok: boolean;
  bot: BotInfo;
  webhook: WebhookInfo;
  adminChatIds?: string[];
}

function formatDate(epochSeconds?: number) {
  if (!epochSeconds) return '-';
  return new Date(epochSeconds * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });
}

export default function TelegramBotPage() {
  const { addToast } = useToast();
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingUp, setSettingUp] = useState(false);
  const [testChatId, setTestChatId] = useState('');
  const [testing, setTesting] = useState(false);
  const [adminChatId, setAdminChatId] = useState('');
  const [adminChatNama, setAdminChatNama] = useState('');
  const [registering, setRegistering] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/telegram');
      if (!res.ok) throw new Error('Gagal ambil status');
      setData(await res.json());
    } catch {
      addToast('error', 'Gagal memuat status bot Telegram');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  async function setupWebhook() {
    setSettingUp(true);
    try {
      const res = await fetch('/api/admin/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup' }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Setup gagal');
      addToast('success', 'Webhook & perintah bot berhasil didaftarkan');
      setData((prev) => (prev ? { ...prev, webhook: json.info } : prev));
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Setup webhook gagal');
    } finally {
      setSettingUp(false);
    }
  }

  async function sendTest() {
    if (!testChatId.trim()) {
      addToast('error', 'Isi chatId (mis. 123456789) dulu');
      return;
    }
    setTesting(true);
    try {
      const res = await fetch('/api/admin/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', chatId: testChatId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Kirim gagal');
      addToast('success', 'Pesan tes terkirim ke Telegram');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Gagal kirim pesan tes');
    } finally {
      setTesting(false);
    }
  }

  async function registerAdminChat() {
    if (!adminChatId.trim()) {
      addToast('error', 'Isi chat id penerima dulu');
      return;
    }
    setRegistering(true);
    try {
      const res = await fetch('/api/admin/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register-admin-chat', chatId: adminChatId, nama: adminChatNama || undefined }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Gagal mendaftarkan');
      setData((prev) => (prev ? { ...prev, adminChatIds: json.adminChatIds } : prev));
      setAdminChatId('');
      setAdminChatNama('');
      addToast('success', 'Chat id terdaftar sebagai penerima notifikasi admin');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Gagal mendaftarkan chat id');
    } finally {
      setRegistering(false);
    }
  }

  async function removeAdminChat(chatId: string) {
    setRemoving(true);
    try {
      const res = await fetch('/api/admin/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-admin-chat', chatId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Gagal menghapus');
      setData((prev) => (prev ? { ...prev, adminChatIds: json.adminChatIds } : prev));
      addToast('success', 'Penerima notifikasi dihapus');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Gagal menghapus chat id');
    } finally {
      setRemoving(false);
    }
  }

  const bot = data?.bot?.result;
  const webhook = data?.webhook?.result;
  const webhookHealthy = Boolean(webhook?.url && !webhook?.last_error_message);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Bot Telegram</h1>
          <p className="text-on-surface-variant">Status, webhook, dan kontrol bot pemesanan Telegram (@rumah_keripik_bot)</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Muat Ulang
        </Button>
      </div>

      {loading && !data ? (
        <div className="grid h-40 place-items-center rounded-2xl border border-outline-variant bg-white text-on-surface-variant">
          <Loader2 className="animate-spin" size={20} />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Status bot */}
          <section className="rounded-2xl border border-outline-variant bg-white p-5">
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-[#059669]" />
              <h2 className="text-lg font-semibold tracking-[-0.02em]">Status Bot</h2>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-neutral-50 p-3">
                <span className="text-on-surface-variant">Bot aktif</span>
                {bot?.username ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#059669]"><CheckCircle2 size={14} /> @{bot.username}</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-red-600"><XCircle size={14} /> Tidak aktif</span>
                )}
              </div>
              <div className="flex items-center justify-between rounded-xl bg-neutral-50 p-3">
                <span className="text-on-surface-variant">Nama</span>
                <span className="font-medium">{bot?.first_name || '-'}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-neutral-50 p-3">
                <span className="text-on-surface-variant">ID Bot</span>
                <span className="font-medium">{bot?.id ?? '-'}</span>
              </div>
            </div>
            <div className="mt-4">
              <Button size="sm" onClick={setupWebhook} disabled={settingUp}>
                {settingUp ? <Loader2 size={14} className="animate-spin" /> : <Webhook size={14} />}
                Daftarkan Webhook & Perintah
              </Button>
              <p className="mt-2 text-xs text-on-surface-variant">
                Mendaftarkan <code className="rounded bg-neutral-100 px-1">/start</code>, <code>/menu</code>,{' '}
                <code>/status</code>, <code>/bantuan</code> + webhook dengan secret_token.
              </p>
            </div>
          </section>

          {/* Status webhook */}
          <section className="rounded-2xl border border-outline-variant bg-white p-5">
            <div className="flex items-center gap-2">
              <Webhook size={18} className="text-[#D97706]" />
              <h2 className="text-lg font-semibold tracking-[-0.02em]">Webhook</h2>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-xl bg-neutral-50 p-3">
                <span className="text-on-surface-variant">URL</span>
                <p className="mt-1 break-all font-medium">{webhook?.url || '-'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-neutral-50 p-3">
                  <span className="text-on-surface-variant">Antrian pesan</span>
                  <p className="mt-1 text-lg font-semibold">{webhook?.pending_update_count ?? '-'}</p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <span className="text-on-surface-variant">Kesehatan</span>
                  <p className="mt-1 font-semibold text-[#059669]">{webhookHealthy ? 'Sehat' : 'Bermasalah'}</p>
                </div>
              </div>
              {webhook?.last_error_message ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                  <span className="text-xs font-semibold text-red-700">Error terakhir ({formatDate(webhook.last_error_date)})</span>
                  <p className="mt-1 break-words text-xs text-red-700">{webhook.last_error_message}</p>
                </div>
              ) : null}
              {webhook?.allowed_updates?.length ? (
                <div className="rounded-xl bg-neutral-50 p-3">
                  <span className="text-on-surface-variant">Update yang diterima</span>
                  <p className="mt-1 font-medium">{webhook.allowed_updates.join(', ')}</p>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      )}

      {/* Kirim pesan tes */}
      <section className="rounded-2xl border border-outline-variant bg-white p-5">
        <div className="flex items-center gap-2">
          <Send size={18} className="text-[#7f9f3e]" />
          <h2 className="text-lg font-semibold tracking-[-0.02em]">Kirim Pesan Tes</h2>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-64">
            <label className="mb-1 block text-xs font-medium text-on-surface-variant" htmlFor="tg-test-chatid">
              Chat ID (contoh: 123456789)
            </label>
            <Input
              id="tg-test-chatid"
              data-testid="telegram-test-chatid"
              value={testChatId}
              onChange={(e) => setTestChatId(e.target.value)}
              placeholder="123456789"
            />
          </div>
          <Button size="sm" onClick={sendTest} disabled={testing} data-testid="telegram-test-send">
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Kirim Tes
          </Button>
          <p className="text-xs text-on-surface-variant">
            Chat ID dapat dilihat dari <code>tg_&lt;id&gt;</code> di Live Chat (tanpa awalan <code>tg_</code>).
          </p>
        </div>
      </section>

      {/* Penerima notifikasi admin */}
      <section className="rounded-2xl border border-outline-variant bg-white p-5">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-[#D97706]" />
          <h2 className="text-lg font-semibold tracking-[-0.02em]">Penerima Notifikasi Admin (Telegram)</h2>
        </div>
        <p className="mt-1 text-sm text-on-surface-variant">
          Semua notifikasi penting (order baru, perlu verifikasi, SOS kurir, stok, sistem) dari dashboard, web, dan
          aplikasi kurir akan dikirim otomatis ke chat id berikut via bot — tanpa perlu buka dashboard. Daftarkan chat
          id admin di sini (cara mendapatkannya: buka bot lalu tekan /start, lalu salin angka dari <code>tg_&lt;id&gt;</code>).
        </p>

        {data?.adminChatIds?.length ? (
          <ul className="mt-4 space-y-2">
            {data.adminChatIds.map((id) => (
              <li key={id} className="flex items-center justify-between rounded-xl bg-neutral-50 p-3">
                <span className="font-mono text-sm">{id}</span>
                <Button
                  variant="outline"
                  size="xs"
                  data-testid={`telegram-admin-remove-${id}`}
                  onClick={() => removeAdminChat(id)}
                  disabled={removing}
                >
                  Hapus
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-xl bg-neutral-50 p-3 text-sm text-on-surface-variant">
            Belum ada penerima notifikasi. Daftarkan chat id admin di bawah.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-52">
            <label className="mb-1 block text-xs font-medium text-on-surface-variant" htmlFor="tg-admin-chatid">
              Chat ID admin
            </label>
            <Input
              id="tg-admin-chatid"
              data-testid="telegram-admin-chatid"
              value={adminChatId}
              onChange={(e) => setAdminChatId(e.target.value)}
              placeholder="123456789"
            />
          </div>
          <div className="w-48">
            <label className="mb-1 block text-xs font-medium text-on-surface-variant" htmlFor="tg-admin-nama">
              Nama (opsional)
            </label>
            <Input
              id="tg-admin-nama"
              data-testid="telegram-admin-nama"
              value={adminChatNama}
              onChange={(e) => setAdminChatNama(e.target.value)}
              placeholder="Admin Utama"
            />
          </div>
          <Button size="sm" onClick={registerAdminChat} disabled={registering} data-testid="telegram-admin-register">
            {registering ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Daftarkan Penerima
          </Button>
        </div>
      </section>
    </div>
  );
}