import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY as string });

async function main() {
  // 1. Count chunks
  const { count } = await sb.from("chunks").select("*", { count: "exact", head: true });
  console.log("Total chunks:", count);

  // 2. Check a sample embedding
  const { data: sample } = await sb.from("chunks").select("id, content, embedding").limit(1).single();
  if (sample) {
    const emb = sample.embedding as string;
    console.log("Sample embedding type:", typeof emb);
    console.log("Sample embedding preview:", String(emb).slice(0, 100));
    console.log("Sample content preview:", sample.content.slice(0, 80));
  }

  // 3. Test query with threshold 0
  const testQuery = "Wie lösche ich die Demo-Daten?";
  console.log("\nTest query:", testQuery);

  const embRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: testQuery,
  });
  const qe = embRes.data[0].embedding;
  console.log("Query embedding length:", qe.length);

  // Test with threshold 0
  const { data: results0, error: err0 } = await sb.rpc("match_chunks", {
    query_embedding: qe,
    match_threshold: 0.0,
    match_count: 10,
  });
  console.log("\nWith threshold 0.0:");
  console.log("  Results:", results0?.length, "Error:", err0?.message);
  if (results0) {
    results0.forEach((r: any) =>
      console.log(`  ${(r.similarity * 100).toFixed(1)}% - ${r.title}`)
    );
  }

  // Test with threshold 0.3
  const { data: results3, error: err3 } = await sb.rpc("match_chunks", {
    query_embedding: qe,
    match_threshold: 0.3,
    match_count: 10,
  });
  console.log("\nWith threshold 0.3:");
  console.log("  Results:", results3?.length, "Error:", err3?.message);
  if (results3) {
    results3.forEach((r: any) =>
      console.log(`  ${(r.similarity * 100).toFixed(1)}% - ${r.title}`)
    );
  }

  // 4. Test another failing query
  const testQuery2 = "E-Mail Versand funktioniert nicht";
  console.log("\nTest query 2:", testQuery2);
  const emb2 = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: testQuery2,
  });
  const { data: res2 } = await sb.rpc("match_chunks", {
    query_embedding: emb2.data[0].embedding,
    match_threshold: 0.0,
    match_count: 5,
  });
  console.log("  Results:", res2?.length);
  if (res2) {
    res2.forEach((r: any) =>
      console.log(`  ${(r.similarity * 100).toFixed(1)}% - ${r.title}`)
    );
  }

  // 5. Check IVFFlat index status
  console.log("\nChecking if IVFFlat index needs rebuild...");
  const { data: indexInfo, error: idxErr } = await sb.rpc("match_chunks", {
    query_embedding: qe,
    match_threshold: -1.0,
    match_count: 200,
  });
  console.log("Total results with threshold -1.0:", indexInfo?.length);
}

main().catch(console.error);
