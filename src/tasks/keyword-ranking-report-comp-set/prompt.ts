import type {
  KeywordRankingReportCompSetDraft,
  KeywordRankingReportCompSetInput,
} from "./schema";

export function buildKeywordRankingCompSetPrompt(opts: {
  input: KeywordRankingReportCompSetInput;
  feedback?: string[];
}): { system: string; prompt: string } {
  const system = `You are a Senior Hospitality Ranking Analyst at SEO Studio.
Analyze search engine ranking positions and competitive share-of-voice across tracked hotel keywords.
Never fabricate ranking success. Output strictly valid JSON matching the requested schema.`;

  const prompt = `Property:
${opts.input.property.name} (${opts.input.property.brand})
Location: ${opts.input.property.city}, ${opts.input.property.state}
Website: ${opts.input.property.url ?? "N/A"}

Compset Domains:
${opts.input.compsetDomains.map((d) => `- ${d}`).join("\n")}

Tracked Keywords:
${opts.input.trackedKeywords.map((k) => `- ${k}`).join("\n")}

${opts.feedback && opts.feedback.length > 0 ? `PREVIOUS VALIDATION ERRORS:\n${opts.feedback.join("\n")}\n` : ""}

Generate a competitive ranking report across these keywords. Output JSON format:
{
  "rankings": [
    {
      "keyword": string,
      "searchVolume": integer,
      "category": string,
      "propertyRank": integer or null,
      "propertyPreviousRank": integer or null,
      "compsetRanks": [
        { "domain": string, "rank": integer or null }
      ],
      "serpFeatures": string[],
      "bestCompetitor": string or null,
      "visibilityIndex": number (0-100)
    }
  ],
  "summary": {
    "top3Count": integer,
    "top10Count": integer,
    "averageRank": number or null,
    "propertyShareOfVoice": number (0-100)
  },
  "strategicInsights": string[]
}`;

  return { system, prompt };
}

export function parseKeywordRankingCompSetDraft(
  rawText: string,
): KeywordRankingReportCompSetDraft {
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ?? [null, rawText];
  const cleaned = jsonMatch[1]?.trim() ?? rawText.trim();
  return JSON.parse(cleaned);
}
