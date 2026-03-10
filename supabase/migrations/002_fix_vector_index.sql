-- Fix: IVFFlat index was created on empty table, causing most chunks to be invisible
-- Replace with HNSW index which works correctly regardless of when it was created

DROP INDEX IF EXISTS idx_chunks_embedding;

CREATE INDEX idx_chunks_embedding ON chunks
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
