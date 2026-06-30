import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateMemory } from '@/lib/memory-engine';

const RAILWAY_AI_URL = process.env.RAILWAY_AI_URL || 'http://localhost:8000';

export async function POST(req: NextRequest) {
  try {
    const { no_wa } = await req.json();
    if (!no_wa) {
      return NextResponse.json({ error: 'no_wa required' }, { status: 400 });
    }

    const memory = await getOrCreateMemory(no_wa);

    let greeting: string;
    try {
      const railRes = await fetch(`${RAILWAY_AI_URL}/api/personalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_wa,
          memory: {
            produk_favorit: memory.produk_favorit,
            total_order: memory.total_order,
            avg_order_value: memory.avg_order_value,
          },
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (railRes.ok) {
        const data = await railRes.json();
        greeting = data.greeting;
      } else {
        greeting = `Selamat datang kembali! Ada yang bisa dibantu? 😊`;
      }
    } catch {
      const fav: string[] = JSON.parse(memory.produk_favorit || '[]') || [];
      if (fav.length > 0) {
        greeting = `Senang bertemu lagi! Masih suka keripik favoritnya? 😊`;
      } else {
        greeting = `Halo! Ada yang bisa kami bantu? 😊`;
      }
    }

    return NextResponse.json({ greeting });
  } catch (err) {
    console.error('[Railway/Personalize]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
