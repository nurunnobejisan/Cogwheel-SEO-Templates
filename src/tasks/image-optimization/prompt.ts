import type { CrawlPageRecord } from "@/core/crawler";
import type { Property } from "@/lib/types";
import {
  imageOptimizationRowSchema,
  type ImageAuditCandidate,
  type ImageOptimizationRowDraft,
  type ImageOptimizationSummary,
} from "./schema";

const GENERIC_ALT_RE = /^(?:img[-_]?\d*|dsc\d*|image\d*|photo\d*|picture\d*|banner|\S+\.(?:jpe?g|png|webp|gif|svg))$/i;

export function detectDeterministicImageIssues(
  pages: CrawlPageRecord[],
  kwMap: Map<string, string>,
): { candidates: ImageAuditCandidate[]; summary: ImageOptimizationSummary } {
  const candidates: ImageAuditCandidate[] = [];
  let totalImages = 0;
  let missingAltCount = 0;
  let genericAltCount = 0;
  let oversizedCount = 0;
  let missingDimensionsCount = 0;
  let nonNextGenCount = 0;

  for (const page of pages) {
    let pathname = "/";
    try {
      pathname = new URL(page.url).pathname.replace(/\/$/, "") || "/";
    } catch {
      pathname = "/";
    }
    const primaryKeyword = kwMap.get(page.url) ?? kwMap.get(pathname) ?? "";

    for (const img of page.images) {
      totalImages++;
      const issues: string[] = [];
      const currentAlt = (img.alt ?? "").trim();

      if (!currentAlt) {
        missingAltCount++;
        issues.push("Missing alt attribute");
      } else if (GENERIC_ALT_RE.test(currentAlt)) {
        genericAltCount++;
        issues.push("Generic/filename alt text");
      }

      if (img.fileSize !== null && img.fileSize > 200_000) {
        oversizedCount++;
        issues.push(`Large file size (${Math.round(img.fileSize / 1024)} KB > 200 KB)`);
      }

      if (img.width === null || img.height === null) {
        missingDimensionsCount++;
        issues.push("Missing width/height attributes (CLS risk)");
      }

      if (/\.(?:jpe?g|png)(?:\?|$)/i.test(img.src)) {
        nonNextGenCount++;
        issues.push("Legacy JPEG/PNG format (consider WebP/AVIF)");
      }

      if (issues.length > 0) {
        candidates.push({
          pageUrl: page.url,
          pageTitle: page.title ?? "",
          primaryKeyword,
          imageSrc: img.src,
          currentAlt,
          width: img.width,
          height: img.height,
          fileSize: img.fileSize,
          issues,
        });
      }
    }
  }

  return {
    candidates,
    summary: {
      totalImages,
      missingAltCount,
      genericAltCount,
      oversizedCount,
      missingDimensionsCount,
      nonNextGenCount,
    },
  };
}

export function buildImageOptimizationPrompt(opts: {
  property: Pick<Property, "name" | "brand" | "city" | "state" | "url" | "notes">;
  candidates: ImageAuditCandidate[];
  feedback?: string[];
}): { system: string; prompt: string } {
  const system = `You are an Expert Hospitality SEO & Web Performance Specialist.
Write descriptive, accessible, concise alt text and image optimization recommendations.

STRICT GROUNDING RULES:
- ONLY output rows for pageUrl + imageSrc pairs provided in the input list.
- Proposed alt text MUST be <= 125 characters, descriptive, natural, and grounded in the page title, image filename/path, and property name/location.
- Do NOT invent amenities or visual details not supported by the page title, URL, filename, or property notes.
- Do NOT stuff keywords or start alt text with "image of" or "photo of".
- Output ONLY a valid JSON array.`;

  const feedbackBlock =
    opts.feedback && opts.feedback.length > 0
      ? `\n\nPREVIOUS VALIDATION FEEDBACK (FIX ALL):\n${opts.feedback.map((f) => `- ${f}`).join("\n")}`
      : "";

  const prompt = `PROPERTY:
- Name: ${opts.property.name} (${opts.property.brand})
- Location: ${opts.property.city}, ${opts.property.state}

IMAGE CANDIDATES (${opts.candidates.length}):
${JSON.stringify(opts.candidates.slice(0, 60), null, 2)}
${feedbackBlock}

Return ONLY a JSON array of objects with keys:
- "pageUrl": string (exact pageUrl from input)
- "imageSrc": string (exact imageSrc from input)
- "currentAlt": string (exact currentAlt from input, or "")
- "proposedAlt": string (descriptive alt text <= 125 chars)
- "issue": string (summary of detected issues)
- "recommendation": string (actionable compression/format/dimension/alt fix)`;

  return { system, prompt };
}

export function parseImageOptimizationDraft(rawText: string): ImageOptimizationRowDraft[] {
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
  return parsed.map((row) => imageOptimizationRowSchema.parse(row));
}

