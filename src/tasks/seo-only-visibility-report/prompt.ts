import type { SeoVisibilityNarrativeDraft, SeoVisibilitySummary } from "./schema";

export function buildSeoVisibilityNarrativePrompt(opts: {
  summary: SeoVisibilitySummary;
  deterministicFindings: string[];
  feedback?: string[];
}): { system: string; prompt: string } {
  const system =
    "You are an SEO analyst writing concise monthly visibility executive takeaways for a hotel client. " +
    "Use ONLY the exact metrics, keyword previews, and deterministic findings provided. " +
    "Never invent rankings, traffic numbers, or amenities. Return valid JSON only.";

  const feedbackBlock =
    opts.feedback && opts.feedback.length > 0
      ? `\n\nFix these validation issues from the prior attempt:\n- ${opts.feedback.join("\n- ")}`
      : "";

  const prompt = `Summarize this monthly SEO visibility report into JSON with shape:
{
  "executiveSummary": "2-3 sentence grounded overview",
  "highlights": ["bullet 1", "bullet 2", "bullet 3"]
}

Report Summary:
${JSON.stringify(opts.summary, null, 2)}

Deterministic Findings:
${opts.deterministicFindings.length > 0 ? opts.deterministicFindings.map((f) => `- ${f}`).join("\n") : "- None"}${feedbackBlock}`;

  return { system, prompt };
}

export function parseSeoVisibilityNarrative(raw: string): SeoVisibilityNarrativeDraft {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Partial<SeoVisibilityNarrativeDraft>;
  return {
    executiveSummary: typeof parsed.executiveSummary === "string" ? parsed.executiveSummary.trim() : "",
    highlights: Array.isArray(parsed.highlights)
      ? parsed.highlights.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [],
  };
}

