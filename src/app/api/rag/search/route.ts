import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createClient } from '@libsql/client';
import { z } from 'zod';

const SearchSchema = z.object({
  vector: z.array(z.number().finite()).min(1).max(3072),
  top_k: z.number().int().min(1).max(20).default(3),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = SearchSchema.parse(await req.json());

    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });

    const vectorStr = `[${body.vector.join(',')}]`;

    const result = await client.execute({
      sql: `
        SELECT id, judul, potongan_teks, kategori,
               vector_distance_cos(vector_embedding, vector(?)) AS distance
        FROM ai_knowledge_base
        WHERE is_active = 1 AND vector_embedding IS NOT NULL
        ORDER BY distance
        LIMIT ?
      `,
      args: [vectorStr, body.top_k],
    });

    const chunks = result.rows
      .filter((row) => (row.distance as number) < 0.4)
      .map((row) => ({
        id: row.id,
        judul: row.judul,
        teks: row.potongan_teks,
        kategori: row.kategori,
        score: 1 - (row.distance as number),
      }));

    return NextResponse.json({ success: true, chunks });
  } catch (error) {
    console.error('[RAG Search] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof z.ZodError ? error.errors[0].message : 'Internal server error' },
      { status: 500 }
    );
  }
}
