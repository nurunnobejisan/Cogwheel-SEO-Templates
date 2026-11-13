import type { HeadingEntry } from "@/core/crawler";
import type { Property } from "@/lib/types";
import type { HeadingStructurePageInput, HeadingStructureRowDraft } from "./schema";

const STYLING_ONLY_HEADING_RE = /^(?:click here|read more|learn more|book now|menu|close|submit|search|\W+)$/i;

/**
 * Deterministic heading checks (no Claude).
 * Detects: missing H1, multiple H1s, skipped levels (e.g. H2 -> H4), empty headings,
 * duplicate H1 across pages, and headings used only for styling.
 */
export function detectDeterministicHeadingIssues(
  pages: Array<{ url: string; headings: HeadingEntry[] }>,
): Map<string, string[]> {
  const issuesByUrl = new Map<string, string[]>();
  const h1Owners = new Map<string, string[]>();

  for (const p of pages) {
    const issues: string[] = [];
    const h1s = p.headings.filter((h) => h.level === 1);

    if (h1s.length === 0) {
      issues.push("Missing H1");
    } else if (h1s.length > 1) {
      issues.push(`Multiple H1s (${h1s.length})`);
    }

    for (const h1 of h1s) {
      const key = h1.text.trim().toLowerCase();
      if (!key) continue;
      const list = h1Owners.get(key) ?? [];
      list.push(p.url);
      h1Owners.set(key, list);
    }

    let prevLevel = 0;
    let hasEmpty = false;
    let hasStylingOnly = false;
    const skipped: string[] = [];

    for (const h of p.headings) {
      const text = h.text.trim();
      if (!text) {
        hasEmpty = true;
      } else if (STYLING_ONLY_HEADING_RE.test(text) || text.length > 140) {
        hasStylingOnly = true;
      }
      if (prevLevel > 0 && h.level - prevLevel > 1) {
        skipped.push(`H${prevLevel} to H${h.level}`);
      }
      prevLevel = h.level;
    }

    if (hasEmpty) issues.push("Empty heading");
    if (skipped.length > 0) issues.push(`Skipped heading level (${skipped.join(", ")})`);
    if (hasStylingOnly) issues.push("Heading used only for styling");

    issuesByUrl.set(p.url, issues);
  }

  for (const [, urls] of h1Owners.entries()) {
    if (urls.length > 1) {
      for (const u of urls) {
        const list = issuesByUrl.get(u) ?? [];
        list.push("Duplicate H1 across pages");
        issuesByUrl.set(u, list);
      }
    }
  }

  return issuesByUrl;
}

export function buildHeadingStructurePrompt(opts: {
  property: Pick<Property, "name" | "brand" | "city" | "state" | "url" | "notes">;
  pages: HeadingStructurePageInput[];
  feedback?: string[];
}): { system: string; prompt: string } {
  const system = [
    "You are a hospitality SEO strategist optimizing page heading hierarchies (H1 and H2).",
    "STRICT GROUNDING RULE: Use ONLY facts present in the crawl data (title, headings, wordCount) or property profile. Never invent amenities, awards, or offers.",
    "DIFF FORMAT: When current H1 or H2 text exists, mark additions with **bold** and removals with ~~strikethrough~~. If missing, write clean new copy wrapped in **bold**.",
    "RULES (evaluated on plain text after stripping ** and ~~removals~~):",
    "- Exactly ONE H1 per page, under 70 characters.",
    "- Include the page's primaryKeyword in the H1 and naturally in at least one H2.",
    "- No skipped heading levels (H1 followed by H2s only).",
    "- No duplicate H1 across pages.",
    "- No placeholder text (TBD, {{...}}) or REMOVE THESE INSTRUCTIONS.",
    'Return ONLY valid JSON: {"rows":[{"url":"...","proposedH1":"...","proposedH2List":["..."],"notes":"..."}]}',
    opts.feedback?.length ? `PREVIOUS ATTEMPT FAILED VALIDATION. Fix these exact issues:\n- ${opts.feedback.join("\n- ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = JSON.stringify({ property: opts.property, pages: opts.pages }, null, 2);
  return { system, prompt };
}

export function parseHeadingStructureDraft(
  raw: string,
  pages: HeadingStructurePageInput[],
): HeadingStructureRowDraft[] {
  const withoutFences = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const jsonText = withoutFences.match(/\{[\s\S]*\}/)?.[0] ?? withoutFences;
  const parsed = JSON.parse(jsonText) as {
    rows?: Array<{
      url?: string;
      proposedH1?: string;
      proposedH2List?: string[];
      proposedOutlineLevels?: number[];
      notes?: string;
    }>;
  };
  if (!Array.isArray(parsed.rows)) {
    throw new Error("Claude response missing rows array");
  }

  const byUrl = new Map(parsed.rows.map((r) => [r.url, r]));
  return pages.map((p) => {
    const found = byUrl.get(p.url);
    const currentH1 = p.headings.find((h) => h.level === 1)?.text ?? "";
    const currentH2List = p.headings.filter((h) => h.level === 2).map((h) => h.text);

    return {
      page: p.page,
      url: p.url,
      currentH1,
      proposedH1: (found?.proposedH1 ?? "").trim(),
      currentH2List,
      proposedH2List: Array.isArray(found?.proposedH2List) ? found!.proposedH2List.map((s) => s.trim()).filter(Boolean) : [],
      proposedOutlineLevels: found?.proposedOutlineLevels,
      issue: p.deterministicIssues.length > 0 ? p.deterministicIssues.join("; ") : "None",
      primaryKeyword: p.primaryKeyword,
      notes: (found?.notes ?? "").trim(),
    };
  });
}

