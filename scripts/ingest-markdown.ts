import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { chunkMarkdown } from "./chunk";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_KEY });

function getAllMdFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...getAllMdFiles(fullPath));
    } else if (entry.endsWith(".md") && entry !== "SKILL.md") {
      files.push(fullPath);
    }
  }
  return files;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const batchSize = 100;
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    console.log(`  Embedding batch ${i / batchSize + 1}...`);
    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
    });
    all.push(...res.data.map((d) => d.embedding));
  }
  return all;
}

async function main() {
  const sourceDir = process.argv[2] || "../AgentSkills-easyfirma-suppport-1";
  console.log(`Scanning MD files in: ${sourceDir}`);

  const mdFiles = getAllMdFiles(sourceDir);
  console.log(`Found ${mdFiles.length} MD files\n`);

  let totalChunks = 0;
  let skipped = 0;

  for (const filePath of mdFiles) {
    const content = readFileSync(filePath, "utf-8");
    const relPath = relative(sourceDir, filePath);

    const doc = chunkMarkdown(content, relPath);

    // Check if already exists
    const { data: existing } = await supabase
      .from("documents")
      .select("id")
      .eq("content_hash", doc.contentHash)
      .single();

    if (existing) {
      console.log(`SKIP (unchanged): ${relPath}`);
      skipped++;
      continue;
    }

    console.log(`Processing: ${relPath} (${doc.chunks.length} chunks)`);

    // Prepare texts for embedding (prepend title + category for context)
    const textsToEmbed = doc.chunks.map(
      (c) => `Titel: ${doc.title}\nKategorie: ${doc.category}\n\n${c.content}`
    );

    const embeddings = await embedBatch(textsToEmbed);

    // Insert document
    const { data: insertedDoc, error: docError } = await supabase
      .from("documents")
      .insert({
        source_type: "markdown",
        file_path: doc.filePath,
        url: doc.url,
        title: doc.title,
        category: doc.category,
        raw_content: doc.rawContent,
        content_hash: doc.contentHash,
      })
      .select("id")
      .single();

    if (docError) {
      console.error(`  ERROR inserting doc: ${docError.message}`);
      continue;
    }

    // Insert chunks
    const chunkRows = doc.chunks.map((chunk, i) => ({
      document_id: insertedDoc.id,
      chunk_index: chunk.chunkIndex,
      content: chunk.content,
      heading: chunk.heading,
      token_count: Math.ceil(chunk.content.length / 4),
      embedding: embeddings[i],
      metadata: chunk.metadata,
    }));

    const { error: chunkError } = await supabase
      .from("chunks")
      .insert(chunkRows);

    if (chunkError) {
      console.error(`  ERROR inserting chunks: ${chunkError.message}`);
    } else {
      totalChunks += chunkRows.length;
    }
  }

  console.log(`\nDone! Ingested ${mdFiles.length - skipped} docs, ${totalChunks} chunks. Skipped ${skipped} unchanged.`);
}

main().catch(console.error);
