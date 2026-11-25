import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { chunkDocument } from "../../../ai/rag";
import type { RagChunk } from "../../../ai/types";

const ROOT = process.cwd();

async function walk(dir: string, acc: string[] = []): Promise<string[]> {
  let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }> = [];
  try {
    entries = (await fs.readdir(dir, { withFileTypes: true })) as unknown as Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>;
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, .next, dist
      if (["node_modules", ".next", "dist", ".git"].includes(entry.name)) continue;
      await walk(full, acc);
    } else if (entry.isFile()) {
      acc.push(full);
    }
  }
  return acc;
}

const INDEXABLE_EXT = new Set([".md", ".txt", ".json"]);

function tagFor(rel: string): string[] {
  const tags = ["repo"];
  if (rel.startsWith("docs/")) tags.push("docs");
  if (rel.startsWith("templates/")) tags.push("templates");
  if (rel.startsWith("rules/")) tags.push("rules");
  if (rel.includes("hotel")) tags.push("hospitality");
  return tags;
}

export async function loadRepoCorpus(): Promise<RagChunk[]> {
  const chunks: RagChunk[] = [];
  const seen = new Set<string>();
  const files = await walk(ROOT);
  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    const ext = path.extname(file).toLowerCase();
    if (!INDEXABLE_EXT.has(ext)) continue;
    // Only index a curated subset of directories
    if (!/^(docs|templates|rules|data|schemas|shared)\//.test(rel)) continue;
    let text = "";
    try {
      text = await fs.readFile(file, "utf8");
    } catch {
      continue;
    }
    if (!text.trim() || text.length < 80) continue;
    // Skip huge files
    if (text.length > 200_000) text = text.slice(0, 200_000);
    const id = rel.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    for (const c of chunkDocument({ id, title: rel, text, source: "repo", url: rel, tags: tagFor(rel), maxChars: 900 })) {
      const key = c.text.trim().toLowerCase().slice(0, 200);
      if (seen.has(key)) continue;
      seen.add(key);
      chunks.push(c);
    }
  }
  return chunks;
}
