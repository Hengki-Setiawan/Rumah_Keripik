export function validateCronRequest(req: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === 'production' && !configuredSecret) {
    return { ok: false, status: 500, error: 'CRON_SECRET wajib di production' };
  }
  if (!configuredSecret) return { ok: true };

  const auth = req.headers.get('authorization');
  const querySecret = new URL(req.url).searchParams.get('secret');
  const validHeader = auth === `Bearer ${configuredSecret}`;
  const validQuery = querySecret === configuredSecret;
  if (!validHeader && !validQuery) return { ok: false, status: 401, error: 'Unauthorized' };

  return { ok: true };
}
