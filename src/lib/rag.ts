import { createServiceClient } from "./supabase";
import { embedText } from "./embeddings";

export interface RetrievedChunk {
  chunk_id: string;
  document_id: string;
  content: string;
  heading: string | null;
  title: string;
  url: string | null;
  file_path: string | null;
  category: string | null;
  similarity: number;
}

export interface RetrievedContext {
  contextText: string;
  sources: { title: string; url: string | null; similarity: number }[];
}

export async function retrieveContext(
  query: string
): Promise<RetrievedContext> {
  const supabase = createServiceClient();

  // 1. Embed the query
  const queryEmbedding = await embedText(query);

  // 2. Vector similarity search
  const { data: chunks, error } = await supabase.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    match_threshold: 0.5,
    match_count: 6,
  });

  if (error) {
    console.error("Vector search error:", error);
    return { contextText: "", sources: [] };
  }

  if (!chunks || chunks.length === 0) {
    return { contextText: "", sources: [] };
  }

  // 3. Deduplicate by document_id (keep highest similarity per doc)
  const seenDocs = new Map<string, RetrievedChunk>();
  for (const chunk of chunks as RetrievedChunk[]) {
    const existing = seenDocs.get(chunk.document_id);
    if (!existing || chunk.similarity > existing.similarity) {
      seenDocs.set(chunk.document_id, chunk);
    }
  }

  const uniqueChunks = Array.from(seenDocs.values()).slice(0, 5);

  // 4. Assemble context
  const contextParts = uniqueChunks.map(
    (chunk, i) =>
      `[Quelle ${i + 1}: ${chunk.title}${chunk.heading ? " > " + chunk.heading : ""}]\n${chunk.content}`
  );

  const sources = uniqueChunks.map((chunk) => ({
    title: chunk.title,
    url: chunk.url,
    similarity: chunk.similarity,
  }));

  return {
    contextText: contextParts.join("\n\n---\n\n"),
    sources,
  };
}
