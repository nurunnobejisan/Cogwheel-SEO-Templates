import type { CrawlPageRecord } from "@/core/crawler";
import type { Property } from "@/lib/types";
import { schemaMarkupItemSchema, type SchemaMarkupItemDraft, type SchemaPageCandidate } from "./schema";

function extractExistingSchemaTypes(jsonLdBlocks: string[]): string[] {
  const types: string[] = [];
  for (const block of jsonLdBlocks) {
    try {
      const parsed = JSON.parse(block) as Record<string, unknown> | Array<Record<string, unknown>>;
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (typeof item?.["@type"] === "string") {
          types.push(item["@type"]);
        } else if (Array.isArray(item?.["@type"])) {
          for (const t of item["@type"]) {
            if (typeof t === "string") types.push(t);
          }
        }
      }
    } catch {
      // Ignore malformed existing JSON-LD; validator/Claude will report it as incomplete
    }
  }
  return [...new Set(types)];
}

export function extractSchemaCandidates(pages: CrawlPageRecord[]): SchemaPageCandidate[] {
  return pages.map((p) => {
    const h1 = p.h1H6.find((h) => h.level === 1)?.text ?? "";
    return {
      pageUrl: p.url,
      title: p.title ?? "",
      metaDescription: p.metaDescription ?? "",
      h1,
      existingTypes: extractExistingSchemaTypes(p.jsonLd),
      existingJsonLdRaw: p.jsonLd.slice(0, 3),
      openGraph: p.openGraph,
    };
  });
}

export function buildSchemaMarkupPrompt(opts: {
  property: Pick<Property, "name" | "brand" | "city" | "state" | "url" | "notes">;
  candidates: SchemaPageCandidate[];
  feedback?: string[];
}): { system: string; prompt: string } {
  const system = `You are a Principal Hospitality Structured Data (Schema.org JSON-LD) Architect.
Audit existing JSON-LD on each crawled page and generate valid, Google-compliant Schema.org JSON-LD (Hotel, LodgingBusiness, Restaurant, EventVenue, FAQPage, BreadcrumbList).

STRICT GROUNDING RULES:
- ONLY use facts explicitly present in the PROPERTY profile, crawled page title/meta/H1, OpenGraph, or existing JSON-LD.
- NEVER fabricate street addresses, postal codes, telephone numbers, star ratings, aggregateRating scores/reviewCounts, priceRange, or geo coordinates if they are not in the input. Omit unknown optional fields rather than guessing.
- Every jsonLd object MUST have "@context": "https://schema.org" and a valid "@type".
- Output ONLY a valid JSON array.`;

  const feedbackBlock =
    opts.feedback && opts.feedback.length > 0
      ? `\n\nPREVIOUS VALIDATION FEEDBACK (FIX ALL):\n${opts.feedback.map((f) => `- ${f}`).join("\n")}`
      : "";

  const prompt = `PROPERTY:
- Name: ${opts.property.name} (${opts.property.brand})
- City/State: ${opts.property.city}, ${opts.property.state}
- URL: ${opts.property.url ?? "N/A"}
- Notes: ${opts.property.notes ?? "None"}

CRAWLED PAGES (${opts.candidates.length}):
${JSON.stringify(opts.candidates.slice(0, 25), null, 2)}
${feedbackBlock}

Return ONLY a JSON array of objects with keys:
- "pageUrl": string (exact pageUrl from input)
- "schemaType": string (e.g. "Hotel", "Restaurant", "EventVenue", "BreadcrumbList")
- "existingTypes": string[] (from input)
- "status": "missing" | "incomplete" | "valid"
- "jsonLd": object (complete valid Schema.org JSON-LD object with "@context": "https://schema.org" and "@type")
- "notes": string (short implementation note)`;

  return { system, prompt };
}

export function parseSchemaMarkupDraft(rawText: string): SchemaMarkupItemDraft[] {
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
  return parsed.map((row) => schemaMarkupItemSchema.parse(row));
}

