import type {
  SiteTechReAuditReportDraft,
  SiteTechReAuditReportInput,
} from "./schema";

export function buildSiteTechReAuditPrompt(opts: {
  input: SiteTechReAuditReportInput;
  feedback?: string[];
}): { system: string; prompt: string } {
  const system = `You are a Principal Technical SEO Quality Auditor at Cogwheel SEO Studio.
Compare current site crawl findings against a baseline technical SEO audit.
Verify which technical issues were resolved, which persist, and identify new regressions.
Output strictly valid JSON conforming to the requested schema.`;

  const prompt = `Property:
${opts.input.property.name} (${opts.input.property.brand})
Website: ${opts.input.property.url}
Baseline Audit Date: ${opts.input.baselineDate ?? "Initial Baseline"}

Prior Baseline Issues:
${(opts.input.priorIssues ?? []).map((i) => `- [${i.severity}] ${i.issueType} on ${i.url}`).join("\n") || "No prior issues recorded."}

Current Re-Crawl Findings:
${(opts.input.currentFindings ?? []).map((i) => `- [${i.severity}] ${i.issueType} on ${i.url}`).join("\n") || "All crawled pages passed."}

${opts.feedback && opts.feedback.length > 0 ? `PREVIOUS VALIDATION ERRORS:\n${opts.feedback.join("\n")}\n` : ""}

Generate a technical re-audit delta report. Output JSON:
{
  "metrics": {
    "resolvedCount": integer,
    "persistentCount": integer,
    "regressionCount": integer,
    "resolutionRatePercent": number (0-100)
  },
  "issueDeltas": [
    {
      "url": string (url),
      "issueType": string,
      "status": "resolved" | "persistent" | "regression" | "new",
      "previousEvidence": string,
      "currentEvidence": string,
      "impact": "Critical" | "High" | "Medium" | "Low",
      "resolutionVerification": string
    }
  ],
  "overallHealthStatus": "significant_improvement" | "moderate_progress" | "stagnant" | "regressed",
  "executiveSummary": string,
  "nextActionChecklist": string[]
}`;

  return { system, prompt };
}

export function parseSiteTechReAuditDraft(rawText: string): SiteTechReAuditReportDraft {
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ?? [null, rawText];
  const cleaned = jsonMatch[1]?.trim() ?? rawText.trim();
  return JSON.parse(cleaned);
}
