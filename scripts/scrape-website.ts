import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import * as cheerio from "cheerio";
import { createHash } from "crypto";
import { chunkMarkdown } from "./chunk";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_KEY });

const SITEMAP_URL = "https://easyfirma.net/ufaq-sitemap.xml";

async function fetchSitemapUrls(): Promise<string[]> {
  console.log("Fetching sitemap...");
  const res = await fetch(SITEMAP_URL);
  const xml = await res.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  const urls: string[] = [];
  $("url loc").each((_, el) => {
    urls.push($(el).text().trim());
  });
  console.log(`Found ${urls.length} FAQ URLs\n`);
  return urls;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function htmlToMarkdown($: cheerio.CheerioAPI, el: any): string {
  // Simple HTML to markdown conversion
  let html = el.html() || "";

  // Convert common HTML to markdown
  html = html.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "\n## $1\n");
  html = html.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "\n### $1\n");
  html = html.replace(/<strong>(.*?)<\/strong>/gi, "**$1**");
  html = html.replace(/<b>(.*?)<\/b>/gi, "**$1**");
  html = html.replace(/<em>(.*?)<\/em>/gi, "*$1*");
  html = html.replace(/<a\s+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");
  html = html.replace(
    /<img\s+[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi,
    "![$2]($1)"
  );
  html = html.replace(/<img\s+[^>]*src="([^"]*)"[^>]*\/?>/gi, "![]($1)");
  html = html.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1");
  html = html.replace(/<br\s*\/?>/gi, "\n");
  html = html.replace(/<p[^>]*>(.*?)<\/p>/gi, "\n$1\n");
  html = html.replace(/<[^>]+>/g, ""); // strip remaining tags
  html = html.replace(/&nbsp;/g, " ");
  html = html.replace(/&amp;/g, "&");
  html = html.replace(/&lt;/g, "<");
  html = html.replace(/&gt;/g, ">");
  html = html.replace(/\n{3,}/g, "\n\n");

  return html.trim();
}

async function scrapePage(
  url: string
): Promise<{ title: string; content: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "EasyFirmaRAGBot/1.0" },
    });
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    // Extract title from h1 or meta
    const title =
      $("h1.entry-title").text().trim() ||
      $("h1").first().text().trim() ||
      $("title").text().trim();

    // Extract main content - try common WordPress selectors
    const contentEl =
      $(".entry-content").first().length > 0
        ? $(".entry-content").first()
        : $(".ufaq-post-content").first().length > 0
          ? $(".ufaq-post-content").first()
          : $("article .content").first().length > 0
            ? $("article .content").first()
            : $("article").first();

    if (!contentEl.length) return null;

    const content = htmlToMarkdown($, contentEl);
    if (content.length < 20) return null;

    return { title, content: `# ${title}\n\n${content}` };
  } catch (err) {
    console.error(`  Error scraping ${url}:`, err);
    return null;
  }
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
  const urls = await fetchSitemapUrls();
  let ingested = 0;
  let skipped = 0;

  for (const url of urls) {
    // Rate limit: 500ms between requests
    await new Promise((r) => setTimeout(r, 500));

    const page = await scrapePage(url);
    if (!page) {
      console.log(`SKIP (no content): ${url}`);
      skipped++;
      continue;
    }

    const contentHash = createHash("sha256")
      .update(page.content)
      .digest("hex");

    // Check if already exists
    const { data: existing } = await supabase
      .from("documents")
      .select("id")
      .eq("content_hash", contentHash)
      .single();

    if (existing) {
      console.log(`SKIP (unchanged): ${url}`);
      skipped++;
      continue;
    }

    // Also check by URL to update if content changed
    const { data: existingByUrl } = await supabase
      .from("documents")
      .select("id")
      .eq("url", url)
      .single();

    if (existingByUrl) {
      // Delete old version (cascade deletes chunks too)
      await supabase.from("documents").delete().eq("id", existingByUrl.id);
      console.log(`UPDATE: ${url}`);
    } else {
      console.log(`NEW: ${url}`);
    }

    const doc = chunkMarkdown(page.content, url);
    doc.url = url;

    const textsToEmbed = doc.chunks.map(
      (c) => `Titel: ${doc.title}\nKategorie: web\n\n${c.content}`
    );

    const embeddings = await embedBatch(textsToEmbed);

    const { data: insertedDoc, error: docError } = await supabase
      .from("documents")
      .insert({
        source_type: "web_scrape",
        file_path: null,
        url,
        title: doc.title,
        category: "web",
        raw_content: doc.rawContent,
        content_hash: contentHash,
      })
      .select("id")
      .single();

    if (docError) {
      console.error(`  ERROR: ${docError.message}`);
      continue;
    }

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
      console.error(`  ERROR chunks: ${chunkError.message}`);
    } else {
      ingested++;
    }
  }

  console.log(
    `\nDone! Ingested ${ingested} pages, skipped ${skipped}.`
  );
}

main().catch(console.error);
