import type { SeoBaselineDraft, SeoBaselineInput } from "./schema";

export function buildSeoBaselinePrompt(opts: {
  input: SeoBaselineInput;
  deterministicFindings: string[];
  feedback?: string[];
}): { system: string; prompt: string } {
  const system =
    "You are a senior hospitality SEO strategist preparing an SEO Baseline & AI Visibility presentation. " +
    "Use ONLY the provided property details, Semrush metrics, trend notes, comp set notes, and AI visibility metrics. " +
    "Never invent traffic numbers, keyword counts, or amenities. " +
    "For compSetTakeaway, write AT MOST 2 sentences explaining what the comparison means for project actions (do NOT restate raw facts). " +
    "Never include placeholder text like [EXAMPLE ANALYSIS] or [insert ...]. Return valid JSON only.";

  const feedbackBlock =
    opts.feedback && opts.feedback.length > 0
      ? `\n\nFix these validation issues from the previous attempt:\n- ${opts.feedback.join("\n- ")}`
      : "";

  const prompt = `Generate slide copy for "${opts.input.property.name}" (${opts.input.property.url}) as JSON:
{
  "mobileTrafficSummary": "1 sentence summarizing mobile organic traffic",
  "mobileKeywordsSummary": "1 sentence summarizing mobile ranking keywords",
  "mobileAnalysis": "1-2 sentences explaining strategic meaning for mobile SEO",
  "desktopTrafficSummary": "1 sentence summarizing desktop organic traffic",
  "desktopKeywordsSummary": "1 sentence summarizing desktop ranking keywords",
  "desktopAnalysis": "1-2 sentences explaining strategic meaning for desktop SEO",
  "compSetTakeaway": "MAX 2 sentences on what comp set position means for project actions",
  "aiVisibilityTakeaway": "2 sentences summarizing AI Visibility score, sentiment, and cited domain focus"
}

Inputs:
${JSON.stringify(opts.input, null, 2)}

Deterministic Findings:
${opts.deterministicFindings.map((f) => `- ${f}`).join("\n")}${feedbackBlock}`;

  return { system, prompt };
}

export function parseSeoBaselineDraft(raw: string): SeoBaselineDraft {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Partial<SeoBaselineDraft>;
  return {
    mobileTrafficSummary: String(parsed.mobileTrafficSummary ?? "").trim(),
    mobileKeywordsSummary: String(parsed.mobileKeywordsSummary ?? "").trim(),
    mobileAnalysis: String(parsed.mobileAnalysis ?? "").trim(),
    desktopTrafficSummary: String(parsed.desktopTrafficSummary ?? "").trim(),
    desktopKeywordsSummary: String(parsed.desktopKeywordsSummary ?? "").trim(),
    desktopAnalysis: String(parsed.desktopAnalysis ?? "").trim(),
    compSetTakeaway: String(parsed.compSetTakeaway ?? "").trim(),
    aiVisibilityTakeaway: String(parsed.aiVisibilityTakeaway ?? "").trim(),
  };
}

