import type {
  FinalSeoGeoProjectReportDraft,
  FinalSeoGeoProjectReportInput,
} from "./schema";

export function buildFinalProjectReportPrompt(opts: {
  input: FinalSeoGeoProjectReportInput;
  feedback?: string[];
}): { system: string; prompt: string } {
  const system = `You are the Executive Managing Director at Cogwheel SEO Studio.
Author the authoritative Final SEO & GEO Project Engagement Report for luxury hotel owners and management executives.
Synthesize all deliverable achievements across On-Page, Technical, Off-Page, Local, and AI Visibility into a polished, high-impact final deliverable.
Never fabricate results. Output strictly valid JSON conforming to the schema.`;

  const prompt = `Hotel Property:
${opts.input.property.name} (${opts.input.property.brand})
Website: ${opts.input.property.url}
Market: ${opts.input.property.city}, ${opts.input.property.state}
Engagement Period: ${opts.input.engagementStartDate} to ${opts.input.engagementEndDate}
Completed Tasks: ${opts.input.completedTasksCount}

${opts.feedback && opts.feedback.length > 0 ? `PREVIOUS VALIDATION ERRORS:\n${opts.feedback.join("\n")}\n` : ""}

Generate the complete final SEO/GEO engagement project report. Output JSON:
{
  "executiveSummary": string,
  "overallProjectScore": number (0-100),
  "deliverableMilestones": [
    {
      "taskCategory": "On Page" | "Technical" | "Off Page" | "Local" | "Reporting",
      "taskName": string,
      "status": "completed" | "verified_live" | "pending_client_action",
      "primaryImpact": string
    }
  ],
  "quantifiableResults": {
    "keywordsInTop10": integer,
    "technicalIssuesResolvedPercent": number (0-100),
    "organicTrafficGrowthPercent": number,
    "aiEngineMentionRatePercent": number (0-100)
  },
  "ongoingMaintenanceChecklist": string[],
  "strategicRoadmapNext12Months": string[]
}`;

  return { system, prompt };
}

export function parseFinalProjectReportDraft(
  rawText: string,
): FinalSeoGeoProjectReportDraft {
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ?? [null, rawText];
  const cleaned = jsonMatch[1]?.trim() ?? rawText.trim();
  return JSON.parse(cleaned);
}
