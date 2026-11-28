import type { CompsetsKeywordsAnalysisDraft, CompsetsKeywordsAnalysisInput } from "./schema";

export function buildCompsetKeywordsPrompt(opts: {
  input: CompsetsKeywordsAnalysisInput;
  feedback?: string[];
}): { system: string; prompt: string } {
  const system = `You are an elite hospitality SEO strategist for SEO Studio.
Analyze competitive keyword gaps between a target hotel property and its primary competitive set.
Output strictly valid JSON matching the requested schema. Never invent unrealistic volume or fabricate metrics.`;

  const prompt = `Target Property:
Name: ${opts.input.property.name}
Brand: ${opts.input.property.brand}
Location: ${opts.input.property.city}, ${opts.input.property.state}
Website: ${opts.input.property.url ?? "N/A"}

Competitive Set Hotels / Domains:
${opts.input.compsetDomains.map((d) => `- ${d}`).join("\n")}

${opts.feedback && opts.feedback.length > 0 ? `PREVIOUS VALIDATION ERRORS (Fix these):\n${opts.feedback.join("\n")}\n` : ""}

Generate a detailed competitive keyword gap analysis. Return a JSON object with:
{
  "gaps": [
    {
      "keyword": string,
      "searchVolume": integer,
      "keywordDifficulty": number (0-100) or null,
      "intent": "informational" | "navigational" | "commercial" | "transactional",
      "competitorDomain": string (one from compset),
      "competitorEstimatedRank": integer or null,
      "propertyCurrentRank": integer or null,
      "opportunityScore": number (0-100),
      "strategicRationale": string
    }
  ],
  "marketSummary": string,
  "topImmediateWins": string[]
}`;

  return { system, prompt };
}

export function parseCompsetKeywordsDraft(rawText: string): CompsetsKeywordsAnalysisDraft {
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ?? [null, rawText];
  const cleaned = jsonMatch[1]?.trim() ?? rawText.trim();
  return JSON.parse(cleaned);
}
