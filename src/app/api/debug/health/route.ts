import { createClient } from '@libsql/client';
import { NextResponse } from 'next/server';
import { getTelegramWebhookInfo } from '@/lib/telegram-bot';
import { resolvePublicBaseUrl } from '@/lib/public-url';
import { requireAdminRoleOrResponse } from '@/lib/admin-actor';

export async function GET() {
  const denied = await requireAdminRoleOrResponse('audit:read');
  if (denied) return denied;

  const env = {
    tursoUrl: Boolean(process.env.TURSO_DATABASE_URL),
    tursoToken: Boolean(process.env.TURSO_AUTH_TOKEN),
    groqApiKey: Boolean(process.env.GROQ_API_KEY),
    geminiApiKey: Boolean(process.env.GEMINI_API_KEY),
    telegramToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    cloudinaryCloud: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
    cloudinaryKey: Boolean(process.env.CLOUDINARY_API_KEY),
    cloudinarySecret: Boolean(process.env.CLOUDINARY_API_SECRET),
    nextauthUrl: process.env.NEXTAUTH_URL ?? null,
    authUrl: process.env.AUTH_URL ?? null,
    publicUrl: resolvePublicBaseUrl(),
    adminUsername: Boolean(process.env.ADMIN_USERNAME),
    adminPassword: Boolean(process.env.ADMIN_PASSWORD),
    nextauthSecret: Boolean(process.env.NEXTAUTH_SECRET),
  };

  const checks: Record<string, unknown> = {};

  try {
    if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
      const dbClient = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
      const dbCheck = await dbClient.execute('select 1 as ok');
      checks.turso = dbCheck.rows?.length ? 'ok' : 'empty';
    } else {
      checks.turso = 'skipped';
    }
  } catch (error) {
    checks.turso = error instanceof Error ? error.message : 'Unknown Turso error';
  }

  try {
    checks.telegram = process.env.TELEGRAM_BOT_TOKEN ? await getTelegramWebhookInfo() : 'skipped';
  } catch (error) {
    checks.telegram = error instanceof Error ? error.message : 'Unknown Telegram error';
  }

  return NextResponse.json({
    ok: true,
    env,
    checks,
    now: new Date().toISOString(),
  });
}
