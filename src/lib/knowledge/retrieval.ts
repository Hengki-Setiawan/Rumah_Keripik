import { createClient } from '@libsql/client';
import { and, desc, eq, like, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { aiKnowledgeBase } from '@/lib/schema';
import { generateQueryEmbedding, toTursoVectorString } from '@/lib/gemini';

export type KnowledgeChunk = {
  id: string | number;
  judul: string;
  teks: string;
  kategori: string | null;
  score: number;
  source: 'vector' | 'keyword';
};

type SearchKnowledgeOptions = {
  query?: string;
  vector?: number[];
  topK?: number;
  maxDistance?: number;
};

export async function searchKnowledgeBase(options: SearchKnowledgeOptions): Promise<KnowledgeChunk[]> {
  const topK = Math.max(1, Math.min(options.topK || 3, 20));
  const query = options.query?.trim();

  try {
    const vector = options.vector || (query ? (await generateQueryEmbedding(query)).embedding : undefined);
    if (vector?.length) {
      const vectorResults = await searchKnowledgeByVector(vector, topK, options.maxDistance ?? 0.42);
      if (vectorResults.length > 0) return vectorResults;
    }
  } catch {
    // Fall back to keyword retrieval when embeddings/vector search are unavailable.
  }

  if (!query) return [];
  return searchKnowledgeByKeyword(query, topK);
}

async function searchKnowledgeByVector(vector: number[], topK: number, maxDistance: number): Promise<KnowledgeChunk[]> {
  const url = process.env.TURSO_DATABASE_URL?.replace(/^libsql:\/\//, 'https://');
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) return [];

  const client = createClient({ url, authToken });
  const result = await client.execute({
    sql: `
      SELECT id, judul, potongan_teks, kategori,
             vector_distance_cos(vector_embedding, vector(?)) AS distance
      FROM ai_knowledge_base
      WHERE is_active = 1 AND vector_embedding IS NOT NULL
      ORDER BY distance
      LIMIT ?
    `,
    args: [toTursoVectorString(vector), topK],
  });

  return result.rows
    .filter((row) => Number(row.distance) < maxDistance)
    .map((row) => ({
      id: row.id as string | number,
      judul: String(row.judul || 'Knowledge Base'),
      teks: String(row.potongan_teks || ''),
      kategori: row.kategori == null ? null : String(row.kategori),
      score: 1 - Number(row.distance || 0),
      source: 'vector' as const,
    }));
}

async function searchKnowledgeByKeyword(query: string, topK: number): Promise<KnowledgeChunk[]> {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((term) => term.length >= 3)
    .slice(0, 6);

  if (terms.length === 0) return [];

  const clauses = terms.flatMap((term) => [
    like(aiKnowledgeBase.judul, `%${term}%`),
    like(aiKnowledgeBase.potongan_teks, `%${term}%`),
    like(aiKnowledgeBase.kategori, `%${term}%`),
  ]);

  const rows = await db
    .select()
    .from(aiKnowledgeBase)
    .where(and(eq(aiKnowledgeBase.is_active, 1), or(...clauses)))
    .orderBy(desc(aiKnowledgeBase.tanggal_upload))
    .limit(topK * 3);

  return rows
    .map((row) => {
      const haystack = `${row.judul} ${row.potongan_teks} ${row.kategori || ''}`.toLowerCase();
      const hits = terms.reduce((count, term) => count + (haystack.includes(term) ? 1 : 0), 0);
      return {
        id: row.id,
        judul: row.judul,
        teks: row.potongan_teks,
        kategori: row.kategori,
        score: hits / terms.length,
        source: 'keyword' as const,
      };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
