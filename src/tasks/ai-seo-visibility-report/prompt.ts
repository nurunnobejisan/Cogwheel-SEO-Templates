import type {
  AiSeoVisibilityReportDraft,
  AiSeoVisibilityReportInput,
} from "./schema";

export function buildAiSeoVisibilityPrompt(opts: {
  input: AiSeoVisibilityReportInput;
  feedback?: string[];
}): { system: string; prompt: string } {
  const system = `You are the Principal Generative Engine Optimization (GEO) & Search Intelligence Director at SEO Studio.
Synthesize quarterly organic search performance with AI search engine citation visibility (ChatGPT Search, Google AI Overviews, Perplexity).
Output strictly valid JSON conforming to the schema.`;

  const prompt = `Property:
${opts.input.property.name} (${opts.input.property.brand})
Website: ${opts.input.property.url}
Location: ${opts.input.property.city}, ${opts.input.property.state}
Period: ${opts.input.quarterPeriod}
Tracked Keywords: ${opts.input.totalTrackedKeywords}
Observed AI Queries: ${opts.input.observedGeoQueriesCount}

${opts.feedback && opts.feedback.length > 0 ? `PREVIOUS VALIDATION ERRORS:\n${opts.feedback.join("\n")}\n` : ""}

Generate a quarterly executive AI & SEO visibility report. Output JSON:
{
  "executiveOverview": string,
  "combinedScore": number (0-100),
  "organicSeoTrends": {
    "top3KeywordsCount": integer,
    "top10KeywordsCount": integer,
    "organicClicksEstimate": integer,
    "primaryGrowthDriver": string
  },
  "geoPlatformMetrics": [
    {
      "platform": "chatgpt_search" | "google_ai_overviews" | "perplexity" | "copilot" | "gemini",
      "brandMentionRatePercent": number (0-100),
      "directCitationRatePercent": number (0-100),
      "topCitedUrl": string (url),
      "competitorComparisonText": string
    }
  ],
  "topAiCitationsEarned": [
    {
      "queryPrompt": string,
      "platform": string,
      "citationUrl": string (url),
      "evidenceSnippet": string
    }
  ],
  "strategicActionsNextQuarter": string[]
}`;

  return { system, prompt };
}

export function parseAiSeoVisibilityDraft(
  rawText: string,
): AiSeoVisibilityReportDraft {
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ?? [null, rawText];
  const cleaned = jsonMatch[1]?.trim() ?? rawText.trim();
  return JSON.parse(cleaned);
}
