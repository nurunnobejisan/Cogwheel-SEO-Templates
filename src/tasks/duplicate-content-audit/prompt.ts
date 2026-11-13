import type { CrawlPageRecord } from "@/core/crawler";
import type { Property } from "@/lib/types";
import {
  duplicateContentRowSchema,
  type DuplicateCluster,
  type DuplicateContentRowDraft,
  type DuplicateContentSummary,
} from "./schema";

export function detectDeterministicDuplicateClusters(pages: CrawlPageRecord[]): {
  clusters: DuplicateCluster[];
  summary: DuplicateContentSummary;
} {
  const clusters: DuplicateCluster[] = [];
  const okPages = pages.filter((p) => p.statusCode === 200);

  const byHash = new Map<string, CrawlPageRecord[]>();
  const byTitle = new Map<string, CrawlPageRecord[]>();
  const byMeta = new Map<string, CrawlPageRecord[]>();
  const thinPages: CrawlPageRecord[] = [];

  for (const page of okPages) {
    if (page.contentHash) {
      const list = byHash.get(page.contentHash) ?? [];
      list.push(page);
      byHash.set(page.contentHash, list);
    }
    const normTitle = (page.title ?? "").trim().toLowerCase();
    if (normTitle) {
      const list = byTitle.get(normTitle) ?? [];
      list.push(page);
      byTitle.set(normTitle, list);
    }
    const normMeta = (page.metaDescription ?? "").trim().toLowerCase();
    if (normMeta) {
      const list = byMeta.get(normMeta) ?? [];
      list.push(page);
      byMeta.set(normMeta, list);
    }
    if (page.wordCount < 250 && !page.needsJsRendering) {
      thinPages.push(page);
    }
  }

  let exactDuplicateClusters = 0;
  for (const [hash, group] of byHash.entries()) {
    if (group.length > 1) {
      exactDuplicateClusters++;
      clusters.push({
        clusterType: "exact-duplicate",
        key: hash,
        urls: group.map((p) => ({
          url: p.url,
          canonical: p.canonical,
          wordCount: p.wordCount,
          title: p.title,
        })),
      });
    }
  }

  let duplicateTitleGroups = 0;
  for (const [title, group] of byTitle.entries()) {
    if (group.length > 1) {
      duplicateTitleGroups++;
      clusters.push({
        clusterType: "duplicate-title",
        key: title,
        urls: group.map((p) => ({
          url: p.url,
          canonical: p.canonical,
          wordCount: p.wordCount,
          title: p.title,
        })),
      });
    }
  }

  let duplicateMetaGroups = 0;
  for (const [meta, group] of byMeta.entries()) {
    if (group.length > 1) {
      duplicateMetaGroups++;
      clusters.push({
        clusterType: "duplicate-meta",
        key: meta,
        urls: group.map((p) => ({
          url: p.url,
          canonical: p.canonical,
          wordCount: p.wordCount,
          title: p.title,
        })),
      });
    }
  }

  for (const page of thinPages) {
    clusters.push({
      clusterType: "thin-content",
      key: `${page.wordCount} words`,
      urls: [
        {
          url: page.url,
          canonical: page.canonical,
          wordCount: page.wordCount,
          title: page.title,
        },
      ],
    });
  }

  return {
    clusters,
    summary: {
      totalPages: okPages.length,
      exactDuplicateClusters,
      duplicateTitleGroups,
      duplicateMetaGroups,
      thinPageCount: thinPages.length,
    },
  };
}

export function buildDuplicateContentPrompt(opts: {
  property: Pick<Property, "name" | "brand" | "city" | "state" | "url">;
  clusters: DuplicateCluster[];
  summary: DuplicateContentSummary;
  feedback?: string[];
}): { system: string; prompt: string } {
  const system = `You are a Principal Hospitality SEO Content & Cannibalization Strategist.
Review deterministic duplicate content, duplicate metadata, and thin-content clusters and recommend exact remediation actions.

STRICT GROUNDING RULES:
- ONLY reference URLs present in the deterministic clusters below.
- Do NOT invent URLs, traffic numbers, or page copy not present in the input.
- Output ONLY a valid JSON array.`;

  const feedbackBlock =
    opts.feedback && opts.feedback.length > 0
      ? `\n\nPREVIOUS VALIDATION FEEDBACK (FIX ALL):\n${opts.feedback.map((f) => `- ${f}`).join("\n")}`
      : "";

  const prompt = `PROPERTY:
- Name: ${opts.property.name} (${opts.property.brand})
- Location: ${opts.property.city}, ${opts.property.state}

SUMMARY:
${JSON.stringify(opts.summary, null, 2)}

CLUSTERS (${opts.clusters.length}):
${JSON.stringify(opts.clusters.slice(0, 50), null, 2)}
${feedbackBlock}

Return ONLY a JSON array of objects with keys:
- "clusterType": "exact-duplicate" | "duplicate-title" | "duplicate-meta" | "thin-content"
- "primaryUrl": string (exact canonical/primary URL from the cluster)
- "affectedUrls": string[] (all affected URLs from the cluster)
- "severity": "high" | "medium" | "low"
- "recommendedAction": "canonicalize" | "301-redirect" | "noindex" | "expand-content" | "differentiate-meta"
- "rationale": string (concise, grounded explanation)`;

  return { system, prompt };
}

export function parseDuplicateContentDraft(rawText: string): DuplicateContentRowDraft[] {
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Claude response did not contain a JSON array.");
  }

  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown[];
  return parsed.map((row) => duplicateContentRowSchema.parse(row));
}

