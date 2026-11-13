import type { Property } from "@/lib/types";
import type { TitleMetaPageInput, TitleMetaRowDraft } from "./schema";

export function buildTitleMetaPrompt(opts: {
  property: Pick<Property, "name" | "brand" | "city" | "state" | "url" | "notes">;
  pages: TitleMetaPageInput[];
  feedback?: string[];
}): { system: string; prompt: string } {
  const system = [
    "You are a hospitality SEO strategist writing Title tags and Meta Descriptions for hotel web pages.",
    "STRICT GROUNDING RULE: Use ONLY facts present in the crawl data (title, meta_description, h1, word_count) or property profile. Never invent amenities, awards, or offers.",
    "DIFF FORMAT: When currentTitle or currentMeta is non-empty, mark additions with **bold** and removals with ~~strikethrough~~. If empty, write clean new copy wrapped in **bold**.",
    "TITLE RULES (evaluated on plain text after stripping ** and ~~removals~~): 50-60 characters total; include the page's primaryKeyword within the first 40 characters; include the brand name at most once; unique across all pages.",
    "META DESCRIPTION RULES (evaluated on plain text after stripping ** and ~~removals~~): 150-160 characters total; include the primaryKeyword; end with a clear call to action (e.g. 'Book your stay today.'); unique across all pages.",
    "No placeholder text (TBD, {{...}}) or REMOVE THESE INSTRUCTIONS blocks.",
    'Return ONLY valid JSON: {"rows":[{"url":"...","proposedTitle":"...","proposedMeta":"...","notes":"..."}]}',
    opts.feedback?.length ? `PREVIOUS ATTEMPT FAILED VALIDATION. Fix these exact issues:\n- ${opts.feedback.join("\n- ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = JSON.stringify(
    {
      property: opts.property,
      pages: opts.pages,
    },
    null,
    2,
  );

  return { system, prompt };
}

export function parseTitleMetaDraft(
  raw: string,
  pages: TitleMetaPageInput[],
): TitleMetaRowDraft[] {
  const withoutFences = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const jsonText = withoutFences.match(/\{[\s\S]*\}/)?.[0] ?? withoutFences;
  const parsed = JSON.parse(jsonText) as {
    rows?: Array<{ url?: string; proposedTitle?: string; proposedMeta?: string; notes?: string }>;
  };
  if (!Array.isArray(parsed.rows)) {
    throw new Error("Claude response missing rows array");
  }

  const byUrl = new Map(parsed.rows.map((r) => [r.url, r]));
  return pages.map((p) => {
    const found = byUrl.get(p.url);
    return {
      page: p.page,
      url: p.url,
      currentTitle: p.currentTitle,
      proposedTitle: (found?.proposedTitle ?? "").trim(),
      currentMeta: p.currentMeta,
      proposedMeta: (found?.proposedMeta ?? "").trim(),
      primaryKeyword: p.primaryKeyword,
      notes: (found?.notes ?? "").trim(),
    };
  });
}

