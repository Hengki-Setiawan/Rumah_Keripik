import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { chatLog } from '@/lib/schema';
import { sql, like, and, gte } from 'drizzle-orm';

export async function GET() {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString();

    const rows = await db
      .select({
        pertanyaan: chatLog.user_message,
        sumber: chatLog.sumber,
        count: sql<number>`COUNT(*)`,
      })
      .from(chatLog)
      .where(and(
        sql`${chatLog.sumber} = 'not_found'`,
        gte(chatLog.timestamp, sinceStr),
      ))
      .groupBy(chatLog.user_message)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(20);

    const unanswered = rows
      .filter((r) => r.pertanyaan.length > 3 && r.pertanyaan.length < 200)
      .map((r) => ({
        pertanyaan: r.pertanyaan.slice(0, 120),
        count: r.count,
      }));

    return NextResponse.json({ unanswered });
  } catch (err) {
    console.error('[Analytics/Bot/Unanswered]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
