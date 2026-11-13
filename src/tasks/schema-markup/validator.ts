import type { ValidationOutcome } from "@/core/pipeline";
import type { TaskRunFlag } from "@/core/runs";
import type { SchemaMarkupItemDraft, SchemaPageCandidate } from "./schema";

export function validateSchemaMarkupItems(opts: {
  draft: SchemaMarkupItemDraft[];
  candidates: SchemaPageCandidate[];
  propertyNotes?: string;
}): ValidationOutcome<SchemaMarkupItemDraft[]> {
  const flags: TaskRunFlag[] = [];
  const feedback: string[] = [];

  if (opts.candidates.length > 0 && opts.draft.length === 0) {
    feedback.push("Draft returned 0 JSON-LD schema items.");
  }

  const candidateByUrl = new Map(opts.candidates.map((c) => [c.pageUrl, c]));

  for (const item of opts.draft) {
    const candidate = candidateByUrl.get(item.pageUrl);
    if (!candidate) {
      feedback.push(`pageUrl "${item.pageUrl}" is not in the crawled page set.`);
      continue;
    }

    const ctx = item.jsonLd["@context"];
    if (ctx !== "https://schema.org" && ctx !== "http://schema.org") {
      feedback.push(`jsonLd["@context"] for ${item.pageUrl} must be "https://schema.org".`);
    }

    const type = item.jsonLd["@type"];
    if (!type || (typeof type !== "string" && !Array.isArray(type))) {
      feedback.push(`jsonLd["@type"] is missing or invalid for ${item.pageUrl}.`);
    }

    const rawExisting = candidate.existingJsonLdRaw.join("\n").toLowerCase();
    const notesLower = (opts.propertyNotes ?? "").toLowerCase();

    if ("aggregateRating" in item.jsonLd && !rawExisting.includes("aggregaterating") && !notesLower.includes("rating")) {
      flags.push({
        code: "ungrounded-schema-field",
        message: `Generated aggregateRating on ${item.pageUrl} without crawled rating evidence — verify before deploying.`,
        severity: "warning",
      });
    }
  }

  if (feedback.length > 0) {
    return { valid: false, feedback, flags };
  }

  return { valid: true, normalized: opts.draft, flags };
}
