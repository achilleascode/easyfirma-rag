import { createHash } from "crypto";

export interface Chunk {
  content: string;
  heading: string | null;
  chunkIndex: number;
  metadata: Record<string, unknown>;
}

export interface DocumentData {
  title: string;
  category: string;
  filePath: string;
  url: string | null;
  rawContent: string;
  contentHash: string;
  chunks: Chunk[];
}

export function chunkMarkdown(
  content: string,
  filePath: string
): DocumentData {
  const lines = content.split("\n");

  // Extract title (first H1)
  const titleLine = lines.find((l) => l.startsWith("# "));
  const title = titleLine ? titleLine.replace(/^#\s+/, "").trim() : filePath;

  // Extract category from file path
  const parts = filePath.split("/");
  const category = parts.length >= 2 ? parts.slice(0, -1).join("/") : "";

  // Extract permalink
  const permalinkLine = lines.find((l) =>
    l.toLowerCase().includes("permalink")
  );
  const urlMatch = permalinkLine?.match(/https?:\/\/[^\s)]+/);
  const url = urlMatch ? urlMatch[0] : null;

  // Extract images
  const images: string[] = [];
  for (const line of lines) {
    const imgMatches = line.matchAll(/!\[.*?\]\((.*?)\)/g);
    for (const match of imgMatches) {
      images.push(match[1]);
    }
  }

  // Content hash for dedup
  const contentHash = createHash("sha256").update(content).digest("hex");

  // Remove the title line for chunking
  const bodyLines = lines.filter((l) => !l.startsWith("# "));
  const bodyContent = bodyLines.join("\n").trim();

  // Estimate tokens (~1 token per 4 chars for German)
  const estimatedTokens = Math.ceil(bodyContent.length / 4);

  // If short enough, keep as single chunk
  if (estimatedTokens <= 500) {
    return {
      title,
      category,
      filePath,
      url,
      rawContent: content,
      contentHash,
      chunks: [
        {
          content: bodyContent,
          heading: null,
          chunkIndex: 0,
          metadata: { images },
        },
      ],
    };
  }

  // Split on H2 headings
  const sections: { heading: string | null; content: string }[] = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  for (const line of bodyLines) {
    if (line.startsWith("## ")) {
      if (currentLines.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentLines.join("\n").trim(),
        });
      }
      currentHeading = line.replace(/^##\s+/, "").trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // Push last section
  if (currentLines.length > 0) {
    sections.push({
      heading: currentHeading,
      content: currentLines.join("\n").trim(),
    });
  }

  // Filter empty sections and build chunks
  const chunks: Chunk[] = sections
    .filter((s) => s.content.length > 10)
    .map((section, i) => {
      // Find images in this section
      const sectionImages: string[] = [];
      for (const match of section.content.matchAll(/!\[.*?\]\((.*?)\)/g)) {
        sectionImages.push(match[1]);
      }

      return {
        content: section.content,
        heading: section.heading,
        chunkIndex: i,
        metadata: { images: sectionImages },
      };
    });

  return {
    title,
    category,
    filePath,
    url,
    rawContent: content,
    contentHash,
    chunks: chunks.length > 0
      ? chunks
      : [{ content: bodyContent, heading: null, chunkIndex: 0, metadata: { images } }],
  };
}
