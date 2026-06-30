import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { chatLog } from '@/lib/schema';
import { sql, gte } from 'drizzle-orm';

export async function GET() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sinceStr = todayStart.toISOString();

    const [total] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(chatLog)
      .where(gte(chatLog.timestamp, sinceStr));

    const [ruleCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(chatLog)
      .where(sql`${chatLog.sumber} = 'rule' AND ${chatLog.timestamp} >= ${sinceStr}`);

    const [groqCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(chatLog)
      .where(sql`${chatLog.sumber} = 'groq' AND ${chatLog.timestamp} >= ${sinceStr}`);

    const [geminiCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(chatLog)
      .where(sql`${chatLog.sumber} = 'gemini' AND ${chatLog.timestamp} >= ${sinceStr}`);

    const [notFoundCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(chatLog)
      .where(sql`${chatLog.sumber} = 'not_found' AND ${chatLog.timestamp} >= ${sinceStr}`);

    const totalCount = total.count || 1;

    return NextResponse.json({
      total_pesan: total.count,
      rule_persen: Math.round(((ruleCount.count || 0) / totalCount) * 100),
      groq_persen: Math.round(((groqCount.count || 0) / totalCount) * 100),
      gemini_persen: Math.round(((geminiCount.count || 0) / totalCount) * 100),
      not_found_persen: Math.round(((notFoundCount.count || 0) / totalCount) * 100),
      avg_response_ms: 0,
    });
  } catch (err) {
    console.error('[Analytics/Bot/Performance]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
