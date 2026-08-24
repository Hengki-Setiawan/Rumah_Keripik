import { timingSafeEqualStr } from '@/lib/auth-jwt';

export function validateCronRequest(req: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === 'production' && !configuredSecret) {
    return { ok: false, status: 500, error: 'CRON_SECRET wajib di production' };
  }
  if (!configuredSecret) return { ok: true };

  // Hanya terima header Authorization (Vercel Cron & cron-job.org keduanya memakai Bearer).
  // Jalur query-param ?secret= dihapus: nilai bisa bocor ke access log.
  const auth = req.headers.get('authorization') ?? '';
  const validHeader = timingSafeEqualStr(auth, `Bearer ${configuredSecret}`);
  if (!validHeader) return { ok: false, status: 401, error: 'Unauthorized' };

  return { ok: true };
}
