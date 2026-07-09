'use server';

import { db } from '@/lib/db';
import { aiKnowledgeBase } from '@/lib/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { generateEmbedding } from '@/lib/gemini';
import { revalidatePath } from 'next/cache';

function splitTeksKeChunks(teks: string, maxLength: number = 500): string[] {
  const paragraphs = teks.split(/\n\n+/);
  const chunks: string[] = [];

  for (const para of paragraphs) {
    if (para.length <= maxLength) {
      if (para.trim()) chunks.push(para.trim());
    } else {
      const sentences = para.split(/(?<=[.!?])\s+/);
      let current = '';
      for (const s of sentences) {
        if ((current + s).length > maxLength) {
          if (current.trim()) chunks.push(current.trim());
          current = s;
        } else {
          current += ' ' + s;
        }
      }
      if (current.trim()) chunks.push(current.trim());
    }
  }

  return chunks;
}

export async function tambahKnowledgeBase(
  judul: string,
  teks: string,
  kategori: string
) {
  try {
    if (!judul || !teks) {
      return { success: false, message: 'Judul dan teks wajib diisi' };
    }

    const chunks = splitTeksKeChunks(teks, 500);
    let embedded = 0;

    for (const chunk of chunks) {
      if (chunk.trim().length < 50) continue;

      let embeddingBuffer: Buffer | null = null;
      try {
        const result = await generateEmbedding(chunk);
      const embedding = result.embedding;
        embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);
      } catch (err) {
        console.warn('Gagal generate embedding untuk chunk, simpan tanpa vector:', err);
      }

      await db.insert(aiKnowledgeBase).values({
        judul,
        potongan_teks: chunk.trim(),
        kategori: kategori || null,
        vector_embedding: embeddingBuffer,
      });
      embedded++;
    }

    revalidatePath('/ai-workspace');
    revalidatePath('/knowledge-base');
    return {
      success: true,
      message: `${embedded} chunk berhasil ditambahkan ke Knowledge Base`,
      chunks: embedded,
    };
  } catch (error) {
    console.error('Error tambah KB:', error);
    return { success: false, message: 'Gagal menambahkan Knowledge Base' };
  }
}

export async function getAllKnowledgeBase() {
  try {
    return await db
      .select({
        id: aiKnowledgeBase.id,
        judul: aiKnowledgeBase.judul,
        potongan_teks: aiKnowledgeBase.potongan_teks,
        kategori: aiKnowledgeBase.kategori,
        tanggal_upload: aiKnowledgeBase.tanggal_upload,
        is_active: aiKnowledgeBase.is_active,
        has_embedding: sql<boolean>`CASE WHEN ${aiKnowledgeBase.vector_embedding} IS NOT NULL THEN 1 ELSE 0 END`,
      })
      .from(aiKnowledgeBase)
      .orderBy(desc(aiKnowledgeBase.tanggal_upload));
  } catch (error) {
    console.error('Error fetch KB:', error);
    return [];
  }
}

export async function hapusKnowledgeBase(id: number) {
  try {
    await db.delete(aiKnowledgeBase).where(eq(aiKnowledgeBase.id, id));
    revalidatePath('/ai-workspace');
    revalidatePath('/knowledge-base');
    return { success: true, message: 'Entri berhasil dihapus' };
  } catch (error) {
    return { success: false, message: 'Gagal menghapus entri' };
  }
}

export async function toggleActiveKnowledgeBase(id: number) {
  try {
    const entry = await db
      .select()
      .from(aiKnowledgeBase)
      .where(eq(aiKnowledgeBase.id, id))
      .limit(1);

    if (entry.length === 0) {
      return { success: false, message: 'Entri tidak ditemukan' };
    }

    await db
      .update(aiKnowledgeBase)
      .set({ is_active: entry[0].is_active ? 0 : 1 })
      .where(eq(aiKnowledgeBase.id, id));

    revalidatePath('/ai-workspace');
    revalidatePath('/knowledge-base');
    return { success: true, message: 'Status berhasil diubah' };
  } catch (error) {
    return { success: false, message: 'Gagal mengubah status' };
  }
}

export async function getStatsKnowledgeBase() {
  try {
    const [result] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        aktif: sql<number>`SUM(CASE WHEN is_active THEN 1 ELSE 0 END)`,
        withEmbedding: sql<number>`SUM(CASE WHEN vector_embedding IS NOT NULL THEN 1 ELSE 0 END)`,
      })
      .from(aiKnowledgeBase);

    return { total: result?.total ?? 0, aktif: result?.aktif ?? 0, withEmbedding: result?.withEmbedding ?? 0 };
  } catch (error) {
    return { total: 0, aktif: 0, withEmbedding: 0 };
  }
}
