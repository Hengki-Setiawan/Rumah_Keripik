import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pesanChat } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const HistoryQuery = z.object({
  no_wa: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const query = HistoryQuery.parse({
      no_wa: searchParams.get('no_wa'),
      limit: searchParams.get('limit') || '50',
    });

    const messages = await db
      .select({
        direction: pesanChat.direction,
        sumber: pesanChat.sumber,
        teks: pesanChat.teks,
        timestamp: pesanChat.timestamp,
        status_kirim: pesanChat.status_kirim,
        channel: pesanChat.channel,
      })
      .from(pesanChat)
      .where(eq(pesanChat.no_wa_pelanggan, query.no_wa))
      .orderBy(desc(pesanChat.timestamp))
      .limit(query.limit);

    return NextResponse.json({ success: true, messages: messages.reverse() });
  } catch (error) {
    console.error('[Chat History] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof z.ZodError ? error.errors[0].message : 'Internal server error' },
      { status: 500 }
    );
  }
}
