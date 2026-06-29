import { db } from '../lib/db';
import { aiKnowledgeBase } from '../lib/schema';
import { isNull, eq } from 'drizzle-orm';
import { generateEmbedding } from '../lib/gemini';

async function reembed() {
  console.log('Memulai re-embedding Knowledge Base...');

  const rows = await db
    .select({ id: aiKnowledgeBase.id, teks: aiKnowledgeBase.potongan_teks })
    .from(aiKnowledgeBase)
    .where(isNull(aiKnowledgeBase.vector_embedding));

  console.log(`Ditemukan ${rows.length} chunk tanpa embedding`);

  if (rows.length === 0) {
    console.log('Semua data sudah memiliki embedding. Selesai.');
    return;
  }

  for (const row of rows) {
    try {
      const result = await generateEmbedding(row.teks);
      const embedding = result.embedding;
      const buf = Buffer.from(new Float32Array(embedding).buffer);
      await db
        .update(aiKnowledgeBase)
        .set({ vector_embedding: buf })
        .where(eq(aiKnowledgeBase.id, row.id));
      console.log(`  id=${row.id} berhasil di-embed`);
    } catch (err) {
      console.error(`  id=${row.id} gagal:`, err);
    }
  }

  console.log('Re-embedding selesai!');
}

reembed().catch(console.error);
