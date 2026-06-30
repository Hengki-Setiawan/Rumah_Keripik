import { NextRequest, NextResponse } from 'next/server';
import { learnFromInteraction } from '@/lib/memory-engine';

const RAILWAY_AI_URL = process.env.RAILWAY_AI_URL || 'http://localhost:8000';

export async function POST(req: NextRequest) {
  try {
    const { user_message, bot_response, rating, no_wa } = await req.json();
    if (!user_message || !bot_response) {
      return NextResponse.json({ error: 'user_message and bot_response required' }, { status: 400 });
    }

    let patternKey: string | null = null;
    let learned = false;

    try {
      const railRes = await fetch(`${RAILWAY_AI_URL}/api/learn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_message, bot_response, rating, no_wa }),
        signal: AbortSignal.timeout(5000),
      });
      if (railRes.ok) {
        const data = await railRes.json();
        learned = data.learned;
        patternKey = data.pattern_key || null;
      }
    } catch {
      // fallback: learn locally
    }

    if (learned && patternKey) {
      await learnFromInteraction(patternKey, bot_response, rating);
    }

    return NextResponse.json({ learned, pattern_key: patternKey });
  } catch (err) {
    console.error('[Railway/Learn]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
