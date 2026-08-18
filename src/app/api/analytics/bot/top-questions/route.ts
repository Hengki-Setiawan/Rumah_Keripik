import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { chatLog } from '@/lib/schema';
import { sql, gte, desc } from 'drizzle-orm';
import { requireAdminRoleOrResponse } from '@/lib/admin-actor';

export async function GET() {
  const denied = await requireAdminRoleOrResponse('audit:read');
  if (denied) return denied;
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString();

    const rows = await db
      .select({
        pertanyaan: chatLog.user_message,
        count: sql<number>`COUNT(*)`,
      })
      .from(chatLog)
      .where(gte(chatLog.timestamp, sinceStr))
      .groupBy(chatLog.user_message)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10);

    const questions = rows
      .filter((r) => r.pertanyaan.length > 3 && r.pertanyaan.length < 100)
      .map((r) => ({
        pertanyaan: r.pertanyaan.slice(0, 80),
        count: r.count,
      }));

    return NextResponse.json({ questions });
  } catch (err) {
    console.error('[Analytics/Bot/TopQuestions]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
