import { createClient } from "@supabase/supabase-js";
import { readdirSync, statSync } from "fs";
import { join, relative } from "path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (f.endsWith(".md") && f !== "SKILL.md") files.push(full);
  }
  return files;
}

async function main() {
  const { data } = await supabase
    .from("documents")
    .select("file_path")
    .eq("source_type", "markdown");

  const inDb = new Set(data?.map((d) => d.file_path) || []);

  const base = process.argv[2] || "/Users/achisumma/AgentSkills-easyfirma-suppport-1";
  const allFiles = walk(base).map((f) => relative(base, f));
  const missing = allFiles.filter((f) => !inDb.has(f));

  console.log(`Total in repo: ${allFiles.length}`);
  console.log(`In DB: ${inDb.size}`);
  console.log(`Missing: ${missing.length}`);
  missing.forEach((f) => console.log(`  MISSING: ${f}`));
}

main().catch(console.error);
