-- Manual Vector Migration
-- Menambahkan vector index pada ai_knowledge_base.vector_embedding (F32_BLOB 3072)
-- Dijalankan SETELAH data seed + embedding agar index bisa dibangun

-- Ubah kolom vector_embedding ke tipe F32_BLOB(3072) (Turso vector search)
-- Catatan: hanya jika belum pernah diubah (masih BLOB biasa)
-- ALTER TABLE ai_knowledge_base ALTER COLUMN vector_embedding TYPE F32_BLOB(3072);

-- Buat vector index untuk cosine similarity search
-- CREATE INDEX IF NOT EXISTS idx_kb_vector ON ai_knowledge_base (libsql_vector_idx(vector_embedding));
