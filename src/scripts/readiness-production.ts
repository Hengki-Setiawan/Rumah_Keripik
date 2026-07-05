import { spawnSync } from 'child_process';
import { config } from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

config({ path: '.env.local' });

type CheckResult = {
  name: string;
  ok: boolean;
  detail?: string;
};

const REQUIRED_ENV = [
  'TURSO_DATABASE_URL',
  'TURSO_AUTH_TOKEN',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'AUTH_URL',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
  'CRON_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME',
] as const;

async function main() {
  const results: CheckResult[] = [];
  results.push(checkEnv());
  results.push(await checkDatabase());
  results.push(await checkCloudinary());
  results.push(runCommand('typecheck', 'npx', ['tsc', '--noEmit']));
  results.push(runCommand('build', 'npm', ['run', 'build']));
  results.push(runCommand('public order smoke', 'npm', ['run', 'smoke:public-order']));

  if (process.env.SMOKE_BASE_URL) {
    results.push(runCommand('http smoke', 'npm', ['run', 'smoke:http']));
    results.push(runCommand('security smoke', 'npm', ['run', 'smoke:security']));
  } else {
    results.push({ name: 'http/security smoke', ok: true, detail: 'Skipped: set SMOKE_BASE_URL to validate a running local or production URL.' });
  }

  const ok = results.every((result) => result.ok);
  console.log(JSON.stringify({ ok, results }, null, 2));
  if (!ok) process.exit(1);
}

function checkEnv(): CheckResult {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  const weakSecrets = [
    ['NEXTAUTH_SECRET', process.env.NEXTAUTH_SECRET],
    ['CRON_SECRET', process.env.CRON_SECRET],
  ].filter(([, value]) => !value || String(value).length < 24);

  if (missing.length) return { name: 'required env', ok: false, detail: `Missing: ${missing.join(', ')}` };
  if (weakSecrets.length) return { name: 'required env', ok: false, detail: `Weak secret length: ${weakSecrets.map(([key]) => key).join(', ')}` };
  return { name: 'required env', ok: true };
}

async function checkDatabase(): Promise<CheckResult> {
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DB ping timeout after 15000ms')), 15_000));
    await Promise.race([
      (async () => {
        const { db } = await import('@/lib/db');
        const { sql } = await import('drizzle-orm');
        await db.run(sql`select 1`);
      })(),
      timeout,
    ]);
    return { name: 'turso database ping', ok: true };
  } catch (error) {
    return { name: 'turso database ping', ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

async function checkCloudinary(): Promise<CheckResult> {
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    await cloudinary.api.ping();
    return { name: 'cloudinary ping', ok: true };
  } catch (error) {
    return { name: 'cloudinary ping', ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

function runCommand(name: string, command: string, args: string[]): CheckResult {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
  return {
    name,
    ok: result.status === 0,
    detail: result.status === 0 ? undefined : result.error?.message || `${command} ${args.join(' ')} exited with ${result.status ?? result.signal ?? 'unknown'}`,
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
