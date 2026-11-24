import type {
  BacklinkingStrategyExecutionDraft,
  BacklinkingStrategyExecutionInput,
} from "./schema";

export function buildBacklinkingExecutionPrompt(opts: {
  input: BacklinkingStrategyExecutionInput;
  feedback?: string[];
}): { system: string; prompt: string } {
  const system = `You are an Operations Director for Off-Page Hospitality SEO at Cogwheel SEO Studio.
Develop an actionable 90-day backlink acquisition sprint roadmap and target pipeline.
Focus on high-converting, legitimate PR and partner link placements. Output strictly valid JSON conforming to the schema.`;

  const prompt = `Property:
${opts.input.property.name} (${opts.input.property.brand})
Website: ${opts.input.property.url}
Location: ${opts.input.property.city}, ${opts.input.property.state}
Target Link Acquisition Goal: ${opts.input.targetAcquisitionCount} links

${opts.feedback && opts.feedback.length > 0 ? `PREVIOUS VALIDATION ERRORS:\n${opts.feedback.join("\n")}\n` : ""}

Generate an execution sprint plan. Output JSON:
{
  "roadmapPhases": [
    {
      "phaseName": string,
      "timelineWeeks": string (e.g. "Weeks 1-4"),
      "primaryDeliverable": string,
      "targetAcquisitions": integer
    }
  ],
  "outreachPipeline": [
    {
      "targetDomain": string,
      "contactPersona": string,
      "pitchAngle": string,
      "status": "prospect" | "contacted" | "in_negotiation" | "acquired" | "declined",
      "targetDestinationUrl": string (url),
      "expectedLinkType": "editorial_mention" | "resource_page" | "partner_directory" | "press_feature",
      "followUpDate": string (YYYY-MM-DD)
    }
  ],
  "kpiTargets": {
    "targetHighAuthorityLinks": integer,
    "targetLocalCitations": integer,
    "targetEditorialFeatures": integer
  }
}`;

  return { system, prompt };
}

export function parseBacklinkingExecutionDraft(
  rawText: string,
): BacklinkingStrategyExecutionDraft {
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ?? [null, rawText];
  const cleaned = jsonMatch[1]?.trim() ?? rawText.trim();
  return JSON.parse(cleaned);
}
