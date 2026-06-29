import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { detectChannel } from '@/lib/utils';
import { db } from '@/lib/db';
import { pesanChat } from '@/lib/schema';
import { z } from 'zod';

const SendSchema = z.object({
  no_wa: z.string().min(1),
  teks: z.string().min(1),
  sumber: z.enum(['bot', 'admin', 'sistem']).default('bot'),
  channel: z.enum(['wa', 'telegram']).optional(),
  id_external: z.string().nullable().optional(),
  status_kirim: z.enum(['sent', 'failed']).default('sent'),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = SendSchema.parse(await req.json());
    const channel = body.channel ?? detectChannel(body.no_wa);

    await db.insert(pesanChat).values({
      no_wa_pelanggan: body.no_wa,
      channel,
      direction: 'out',
      sumber: body.sumber,
      teks: body.teks,
      id_external: body.id_external ?? null,
      status_kirim: body.status_kirim,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Chat Send] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof z.ZodError ? error.errors[0].message : 'Internal server error' },
      { status: 500 }
    );
  }
}
