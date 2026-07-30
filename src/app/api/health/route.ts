import { createClient } from '@libsql/client';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, unknown> = {};
  let healthy = true;

  try {
    if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
      const client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
      const result = await client.execute('select 1 as ok');
      checks.database = result.rows?.length ? 'ok' : 'empty';
    } else {
      checks.database = 'skipped';
      healthy = false;
    }
  } catch (e) {
    checks.database = e instanceof Error ? e.message : 'error';
    healthy = false;
  }

  checks.env = {
    turso: Boolean(process.env.TURSO_DATABASE_URL),
    sentry: Boolean(process.env.SENTRY_DSN),
    nextauth: Boolean(process.env.NEXTAUTH_SECRET),
    cron: Boolean(process.env.CRON_SECRET),
  };

  return NextResponse.json(
    { ok: healthy, checks, now: new Date().toISOString() },
    { status: healthy ? 200 : 503 },
  );
}
