import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { count } from 'drizzle-orm';
import { pelangganChatbot, pesanChat } from '@/lib/schema';

export async function GET() {
  try {
    const [pelanggan] = await db.select({ total: count() }).from(pelangganChatbot);
    const [pesan] = await db.select({ total: count() }).from(pesanChat);

    return NextResponse.json({
      ok: true,
      env: {
        tursoUrl: Boolean(process.env.TURSO_DATABASE_URL),
        tursoToken: Boolean(process.env.TURSO_AUTH_TOKEN),
        telegramToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
        evolutionUrl: Boolean(process.env.EVOLUTION_API_URL),
        evolutionKey: Boolean(process.env.EVOLUTION_API_KEY),
        nextauthUrl: process.env.NEXTAUTH_URL ?? null,
        authUrl: process.env.AUTH_URL ?? null,
      },
      db: {
        pelanggan: pelanggan?.total ?? 0,
        pesan: pesan?.total ?? 0,
      },
      now: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
