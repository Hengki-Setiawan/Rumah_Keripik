import { db } from '@/lib/db';
import { botSetting, transaksi, workerJob, aiRuns, telegramAdminChats } from '@/lib/schema';
import { sql, eq, gte, and } from 'drizzle-orm';
import { getCronHeartbeats, FREQUENT_CRON_JOBS } from '@/lib/cron-monitor';
import { getTelegramAdminChatIds } from '@/lib/telegram-admin';

export const dynamic = 'force-dynamic';

function badge(ok: boolean, textOk: string, textBad: string) {
  return ok ? (
    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{textOk}</span>
  ) : (
    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">{textBad}</span>
  );
}

export default async function OpsHealthPage() {
  const heartbeats = await getCronHeartbeats();
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const [lastBackupRow] = await db
    .select({ value: botSetting.value_json })
    .from(botSetting)
    .where(eq(botSetting.key, 'ops.last_backup_at'))
    .limit(1);
  let lastBackup: string | null = null;
  try {
    lastBackup = lastBackupRow ? (JSON.parse(lastBackupRow.value) as string) : null;
  } catch {
    lastBackup = null;
  }

  const [counts] = await db
    .select({
      transaksi: sql<number>`(select count(*) from transaksi)`,
      workerPending: sql<number>`(select count(*) from worker_job where status = 'pending')`,
      aiRuns24h: sql<number>`(select count(*) from ai_runs where created_at >= datetime('now','-1 day'))`,
      chatAktif: sql<number>`(select count(*) from chat_sessions where status = 'active')`,
    })
    .from(sql`(select 1) as t`);

  const telegramRecipients = await getTelegramAdminChatIds();
  const midtransMode = process.env.MIDTRANS_MODE || 'sandbox';
  const fonnteSet = Boolean(process.env.FONNTE_TOKEN);
  const telegramSet = Boolean(process.env.TELEGRAM_BOT_TOKEN);

  const cronRows = Object.entries(FREQUENT_CRON_JOBS).map(([job, maxAgeMin]) => {
    const last = heartbeats[job] ?? null;
    const ageMin = last ? Math.round((now - new Date(last).getTime()) / 60_000) : null;
    const ok = ageMin !== null && ageMin <= maxAgeMin;
    return { job, last, ageMin, maxAgeMin, ok };
  });
  const allCronOk = cronRows.every((r) => r.ok);

  const backupAgeHours = lastBackup ? Math.round((now - new Date(lastBackup).getTime()) / 3_600_000) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Health Check</h1>
        <p className="text-on-surface-variant">Pendeteksi dini: cron, backup, dan konfigurasi kritis. Alert Telegram otomatis saat cron gagal/diam.</p>
      </div>

      <section className="rounded-2xl border border-outline-variant bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-[-0.02em]">Heartbeat Cron</h2>
          {badge(allCronOk, 'SEMUA HIDUP', 'ADA YANG MATI')}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-on-surface-variant">
                <th className="pb-2">Job</th><th className="pb-2">Terakhir jalan</th><th className="pb-2">Umur</th><th className="pb-2">Batas</th><th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {cronRows.map((r) => (
                <tr key={r.job} className="border-t border-outline-variant">
                  <td className="py-2 font-medium">/api/cron/{r.job}</td>
                  <td className="py-2">{r.last ? new Date(r.last).toLocaleString('id-ID', { timeZone: 'Asia/Makassar' }) : '—'}</td>
                  <td className="py-2">{r.ageMin !== null ? `${r.ageMin} mnt` : '—'}</td>
                  <td className="py-2">{r.maxAgeMin} mnt</td>
                  <td className="py-2">{badge(r.ok, 'HIDUP', 'MATI/DIAM')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-on-surface-variant">Heartbeat terisi setelah versi baru ini berjalan minimal satu siklus cron (±15 menit).</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-outline-variant bg-white p-5">
          <h2 className="text-xl font-semibold tracking-[-0.02em]">Backup Database</h2>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Backup terakhir</span>
              {badge(backupAgeHours !== null && backupAgeHours <= 26, backupAgeHours !== null ? `${backupAgeHours} jam lalu` : 'belum ada data', backupAgeHours !== null ? `${backupAgeHours} jam lalu` : 'belum ada data')}
            </div>
            <p className="text-xs text-on-surface-variant">Ditulis oleh script backup lokal (Task Scheduler 02:30). Offsite: GitHub Releases repo Docs/Courier.</p>
          </div>
        </section>

        <section className="rounded-2xl border border-outline-variant bg-white p-5">
          <h2 className="text-xl font-semibold tracking-[-0.02em]">Ringkasan Data</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-neutral-50 p-3"><div className="text-on-surface-variant text-xs">Total pesanan</div><div className="text-2xl font-semibold">{counts?.transaksi ?? '—'}</div></div>
            <div className="rounded-xl bg-neutral-50 p-3"><div className="text-on-surface-variant text-xs">Worker pending</div><div className="text-2xl font-semibold">{counts?.workerPending ?? '—'}</div></div>
            <div className="rounded-xl bg-neutral-50 p-3"><div className="text-on-surface-variant text-xs">AI calls 24 jam</div><div className="text-2xl font-semibold">{counts?.aiRuns24h ?? '—'}</div></div>
            <div className="rounded-xl bg-neutral-50 p-3"><div className="text-on-surface-variant text-xs">Chat aktif</div><div className="text-2xl font-semibold">{counts?.chatAktif ?? '—'}</div></div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-outline-variant bg-white p-5">
        <h2 className="text-xl font-semibold tracking-[-0.02em]">Konfigurasi Kritis</h2>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between rounded-xl bg-neutral-50 p-3">
            <span>Mode Midtrans</span>
            {badge(midtransMode === 'production', 'PRODUCTION', `SANDBOX (${midtransMode})`)}
          </div>
          <div className="flex items-center justify-between rounded-xl bg-neutral-50 p-3">
            <span>Telegram bot (alert cron)</span>
            {badge(telegramSet && telegramRecipients.length > 0, `aktif, ${telegramRecipients.length} penerima`, telegramSet ? 'bot ada, 0 penerima — daftarkan chat di /telegram-bot' : 'token tidak ada')}
          </div>
          <div className="flex items-center justify-between rounded-xl bg-neutral-50 p-3">
            <span>Fonnte (WhatsApp OTP/notifikasi)</span>
            {badge(fonnteSet, 'token terpasang', 'token tidak ada')}
          </div>
        </div>
      </section>
    </div>
  );
}
