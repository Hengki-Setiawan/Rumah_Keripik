import { db } from '../lib/db';
import { aiKnowledgeBase } from '../lib/schema';
import { isNull, eq } from 'drizzle-orm';
import { generateEmbedding } from '../lib/gemini';

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 2000;

async function reembedBatch() {
  console.log('Memulai re-embedding Batch Knowledge Base...');
  const rows = await db
    .select({ id: aiKnowledgeBase.id, teks: aiKnowledgeBase.potongan_teks })
    .from(aiKnowledgeBase)
    .where(isNull(aiKnowledgeBase.vector_embedding));
  console.log(`Ditemukan ${rows.length} chunk tanpa embedding`);
  if (rows.length === 0) { console.log('Semua sudah memiliki embedding.'); return; }
  let success = 0; let fail = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rows.length / BATCH_SIZE)} (${batch.length} items)...`);
    await Promise.allSettled(batch.map(async (row) => {
      try {
        const result = await generateEmbedding(row.teks);
        const buf = Buffer.from(new Float32Array(result.embedding).buffer);
        await db.update(aiKnowledgeBase).set({ vector_embedding: buf }).where(eq(aiKnowledgeBase.id, row.id));
        success++;
      } catch (err) { fail++; console.error(`  id=${row.id} gagal:`, err); }
    }));
    if (i + BATCH_SIZE < rows.length) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }
  console.log(`Selesai! ${success} sukses, ${fail} gagal.`);
}

reembedBatch().catch(console.error);
