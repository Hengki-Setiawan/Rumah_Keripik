import { db } from '@/lib/db';
import { botSetting } from '@/lib/schema';
import { like, sql } from 'drizzle-orm';
import { pushTelegramAdminNotification } from '@/lib/telegram-admin';

const HB_PREFIX = 'cron.last_run.';
const ALERT_PREFIX = 'cron.last_alert.';

/** Job sering -> umur maksimum heartbeat (menit) sebelum dianggap mati. */
export const FREQUENT_CRON_JOBS: Record<string, number> = {
  worker: 30,
  'route-build': 30,
  'stock-watch': 30,
  'auto-dispatch': 30,
  'midtrans-reconcile': 130,
  cleanup: 26 * 60,
  'courier-ops': 26 * 60,
};

async function upsertSetting(key: string, valueJson: string) {
  await db
    .insert(botSetting)
    .values({ key, value_json: valueJson, updated_by: 'cron-monitor' })
    .onConflictDoUpdate({
      target: botSetting.key,
      set: { value_json: valueJson, updated_at: sql`(datetime('now','utc'))` },
    });
}

export async function touchCronHeartbeat(job: string) {
  try {
    await upsertSetting(HB_PREFIX + job, JSON.stringify(new Date().toISOString()));
  } catch (error) {
    console.error(`[cron-monitor] gagal simpan heartbeat ${job}:`, error);
  }
}

export async function getCronHeartbeats(): Promise<Record<string, string>> {
  try {
    const rows = await db
      .select({ key: botSetting.key, value: botSetting.value_json })
      .from(botSetting)
      .where(like(botSetting.key, HB_PREFIX + '%'));
    const out: Record<string, string> = {};
    for (const row of rows) {
      try {
        out[row.key.slice(HB_PREFIX.length)] = JSON.parse(row.value) as string;
      } catch {
        /* abaikan nilai rusak */
      }
    }
    return out;
  } catch {
    return {};
  }
}

export async function notifyCronFailure(job: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[CRON][${job}] GAGAL: ${message}`);
  try {
    await pushTelegramAdminNotification({
      title: `Cron ${job} gagal`,
      body: message.slice(0, 500),
      dedupeKey: `cron-fail-${job}-${new Date().toISOString().slice(0, 13)}`,
    });
  } catch (notifyError) {
    console.error('[cron-monitor] gagal kirim notifikasi Telegram:', notifyError);
  }
}

/** Panggil dari job worker (15 menit): waspada bila cron lain berhenti diam-diam. */
export async function checkCronStaleness() {
  try {
    const beats = await getCronHeartbeats();
    const alertRows = await db
      .select({ key: botSetting.key, value: botSetting.value_json })
      .from(botSetting)
      .where(like(botSetting.key, ALERT_PREFIX + '%'));
    const lastAlert = new Map<string, number>();
    for (const row of alertRows) {
      try {
        lastAlert.set(row.key.slice(ALERT_PREFIX.length), new Date(JSON.parse(row.value)).getTime());
      } catch {
        /* abaikan */
      }
    }

    for (const [job, maxAgeMin] of Object.entries(FREQUENT_CRON_JOBS)) {
      const last = beats[job];
      if (!last) continue; // belum pernah berjalan sejak fitur ada — bukan kegagalan
      const ageMin = (Date.now() - new Date(last).getTime()) / 60_000;
      if (ageMin <= maxAgeMin) continue;
      const alertedAt = lastAlert.get(job) ?? 0;
      if (Date.now() - alertedAt < 60 * 60_000) continue; // maksimal 1 alert per jam per job
      await pushTelegramAdminNotification({
        title: `Cron ${job} diam terlalu lama`,
        body: `Terakhir berjalan ${Math.round(ageMin)} menit lalu (batas ${maxAgeMin} menit). Periksa cron-job.org dan endpoint /api/cron/${job}.`,
        dedupeKey: `cron-stale-${job}`,
      });
      await upsertSetting(ALERT_PREFIX + job, JSON.stringify(new Date().toISOString()));
    }
  } catch (error) {
    console.error('[cron-monitor] checkCronStaleness gagal:', error);
  }
}

/** Bungkus logika cron: heartbeat saat sukses, alert Telegram saat gagal. */
export async function runCronJob<T>(job: string, fn: () => Promise<T>): Promise<T> {
  try {
    const result = await fn();
    await touchCronHeartbeat(job);
    if (job === 'worker') void checkCronStaleness();
    return result;
  } catch (error) {
    await notifyCronFailure(job, error);
    throw error;
  }
}
