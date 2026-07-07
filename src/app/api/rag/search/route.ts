import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { searchKnowledgeBase } from '@/lib/knowledge/retrieval';

const SearchSchema = z.object({
  query: z.string().min(1).max(800).optional(),
  vector: z.array(z.number().finite()).min(1).max(3072).optional(),
  top_k: z.number().int().min(1).max(20).default(3),
}).refine((value) => value.query || value.vector, { message: 'query atau vector wajib diisi' });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = SearchSchema.parse(await req.json());
    const chunks = await searchKnowledgeBase({ query: body.query, vector: body.vector, topK: body.top_k });
    return NextResponse.json({ success: true, chunks });
  } catch (error) {
    console.error('[RAG Search] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof z.ZodError ? error.errors[0].message : 'Internal server error' },
      { status: 500 }
    );
  }
}
