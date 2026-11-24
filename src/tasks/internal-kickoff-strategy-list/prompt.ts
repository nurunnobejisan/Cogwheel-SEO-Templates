import type {
  InternalKickoffStrategyListDraft,
  InternalKickoffStrategyListInput,
} from "./schema";

export function buildInternalKickoffStrategyPrompt(opts: {
  input: InternalKickoffStrategyListInput;
  feedback?: string[];
}): { system: string; prompt: string } {
  const system = `You are a Senior Digital PR & Hospitality Off-Page SEO Director at Cogwheel SEO Studio.
Develop linkable property assets, PR narrative angles, and tier-1 publication outreach targets.
Never suggest spammy PBNs or link schemes. Output strictly valid JSON conforming to the schema.`;

  const prompt = `Hotel Property:
${opts.input.property.name} (${opts.input.property.brand})
Website: ${opts.input.property.url}
Market: ${opts.input.property.city}, ${opts.input.property.state}
Amenities: ${opts.input.property.amenities?.join(", ") || "Standard Full Service"}
Dining: ${opts.input.property.diningInfo?.join(", ") || "Onsite Restaurant & Bar"}
Attractions: ${opts.input.property.attractions?.join(", ") || "City Center & Downtown"}

${opts.feedback && opts.feedback.length > 0 ? `PREVIOUS VALIDATION ERRORS:\n${opts.feedback.join("\n")}\n` : ""}

Generate an off-page strategy kickoff list. Output JSON:
{
  "executiveOffPageVision": string,
  "linkableAssets": [
    {
      "assetTitle": string,
      "pageUrl": string (optional),
      "uniqueHook": string,
      "targetAudiences": string[],
      "pitchAngle": string,
      "estimatedLinkEquity": "High" | "Medium" | "Tier-1 Editorial"
    }
  ],
  "outreachCategories": [
    {
      "categoryName": string,
      "description": string,
      "exampleOutlets": string[],
      "approachStrategy": string
    }
  ],
  "immediateNextSteps": string[]
}`;

  return { system, prompt };
}

export function parseInternalKickoffStrategyDraft(
  rawText: string,
): InternalKickoffStrategyListDraft {
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ?? [null, rawText];
  const cleaned = jsonMatch[1]?.trim() ?? rawText.trim();
  return JSON.parse(cleaned);
}
