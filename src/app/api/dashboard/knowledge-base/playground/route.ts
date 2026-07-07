import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { generateTextWithRouter } from '@/lib/ai/model-router';
import { ORDER_ASSISTANT_SYSTEM_PROMPT } from '@/lib/ai/prompts/order-assistant';
import { searchKnowledgeBase } from '@/lib/knowledge/retrieval';

const PlaygroundSchema = z.object({ question: z.string().min(3).max(800) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const parsed = PlaygroundSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Pertanyaan tidak valid' }, { status: 400 });

  const chunks = await searchKnowledgeBase({ query: parsed.data.question, topK: 5 }).catch(() => []);
  const context = chunks.map((chunk, index) => `[${index + 1}] ${chunk.judul}: ${chunk.teks}`).join('\n');
  const result = await generateTextWithRouter({
    task: 'faq_answer',
    systemPrompt: `${ORDER_ASSISTANT_SYSTEM_PROMPT}\nJawab singkat dari knowledge base berikut. Jika tidak ada source relevan, bilang perlu admin review.\n${context}`,
    messages: [{ role: 'user', content: parsed.data.question }],
    maxTokens: 220,
    temperature: 0.1,
  });

  return NextResponse.json({ ok: true, answer: result.text, provider: result.provider, model: result.model, chunks });
}
