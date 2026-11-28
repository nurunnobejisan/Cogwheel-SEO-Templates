import type {
  CompetitorsBacklinkAnalysisDraft,
  CompetitorsBacklinkAnalysisInput,
} from "./schema";

export function buildCompetitorsBacklinkPrompt(opts: {
  input: CompetitorsBacklinkAnalysisInput;
  feedback?: string[];
}): { system: string; prompt: string } {
  const system = `You are a Principal Off-Page SEO & Backlink Intelligence Strategist at SEO Studio.
Analyze competitive backlink profiles and identify high-equity referring domain gaps for hotel properties.
Never suggest toxic link schemes. Output strictly valid JSON conforming to the requested schema.`;

  const prompt = `Target Property:
${opts.input.property.name} (${opts.input.property.brand})
Website: ${opts.input.property.url}
Location: ${opts.input.property.city}, ${opts.input.property.state}

Compset Domains:
${opts.input.compsetDomains.map((d) => `- ${d}`).join("\n")}

${opts.feedback && opts.feedback.length > 0 ? `PREVIOUS VALIDATION ERRORS:\n${opts.feedback.join("\n")}\n` : ""}

Generate a competitive backlink analysis report. Output JSON:
{
  "backlinkShareOfVoice": {
    "propertyEstimatedRefDomains": integer,
    "compsetAverageRefDomains": integer,
    "estimatedBacklinkGap": integer
  },
  "referringDomainGaps": [
    {
      "domain": string,
      "domainAuthority": integer (0-100) or null,
      "category": string,
      "competitorLinksCount": integer,
      "competitorsLinking": string[],
      "propertyHasLink": boolean,
      "acquisitionDifficulty": "Easy" | "Moderate" | "Hard",
      "recommendedAnchorText": string,
      "targetPageRecommendation": string
    }
  ],
  "highValueDirectoryCitations": string[],
  "strategicRecommendations": string[]
}`;

  return { system, prompt };
}

export function parseCompetitorsBacklinkDraft(
  rawText: string,
): CompetitorsBacklinkAnalysisDraft {
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ?? [null, rawText];
  const cleaned = jsonMatch[1]?.trim() ?? rawText.trim();
  return JSON.parse(cleaned);
}
