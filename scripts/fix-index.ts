import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function main() {
  console.log("Dropping broken IVFFlat index...");
  const { error: e1 } = await sb.rpc("match_chunks", {
    query_embedding: Array(1536).fill(0),
    match_threshold: -99,
    match_count: 1,
  });
  // We need to use raw SQL - let's use the pg endpoint

  // Use fetch to execute SQL via Supabase REST
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

  const sql = `
    DROP INDEX IF EXISTS idx_chunks_embedding;
    CREATE INDEX idx_chunks_embedding ON chunks
      USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
  `;

  // Execute via pg-meta API
  const res = await fetch(`${url}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  console.log("Note: Cannot execute DDL via REST API.");
  console.log("Please run this SQL in Supabase SQL Editor:");
  console.log(sql);
}

main().catch(console.error);
