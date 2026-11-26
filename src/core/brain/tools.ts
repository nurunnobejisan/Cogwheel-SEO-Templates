import "server-only";

import { runFullWebsiteAudit } from "@/core/full-audit";
import { performKeywordResearch } from "@/core/open-seo/keyword-research";
import { detectGaps } from "@/core/visibility/gap-detector";
import { latestVisibilityRun } from "@/core/visibility/store";
import type { VisibilityRun } from "@/core/visibility/types";

export interface ToolResult<T = unknown> {
  name: string;
  available: boolean;
  reason?: string;
  provenance: "measured" | "estimated" | "unavailable";
  data: T | null;
}

type AuditReport = Awaited<ReturnType<typeof runFullWebsiteAudit>>;

export async function fullAuditTool(targetUrl: string, maxPages = 10): Promise<ToolResult<AuditReport>> {
  try {
    const report = await runFullWebsiteAudit({ targetUrl, maxPages, includeGsc: true, includeGeo: true });
    return { name: "full_audit", available: true, provenance: "measured", data: report };
  } catch (err) {
    return {
      name: "full_audit",
      available: false,
      provenance: "unavailable",
      reason: String(err),
      data: null,
    };
  }
}

export function schemaCheckTool(report: AuditReport | null): ToolResult {
  if (!report) return { name: "schema_check", available: false, provenance: "unavailable", reason: "no audit", data: null };
  return { name: "schema_check", available: true, provenance: "measured", data: report.schemaValidation };
}

export function keywordResearchTool(seedTerm: string): ToolResult {
  const result = performKeywordResearch(seedTerm);
  const available = result.dataSource === "provider";
  return {
    name: "keyword_research",
    available,
    provenance: available ? "measured" : "unavailable",
    reason: available ? undefined : `data source: ${result.dataSource}`,
    data: result,
  };
}

export function searchConsoleTool(report: AuditReport | null): ToolResult {
  if (!report) return { name: "search_console", available: false, provenance: "unavailable", reason: "no audit", data: null };
  const sc = report.searchConsole;
  const available = Boolean(sc?.isConnected);
  return {
    name: "search_console",
    available,
    provenance: available ? "measured" : "unavailable",
    reason: available ? undefined : "Google Search Console not connected",
    data: sc,
  };
}

export function serpDataTool(report: AuditReport | null): ToolResult {
  if (!report) return { name: "serp_data", available: false, provenance: "unavailable", reason: "no audit", data: null };
  // SERP data is derived from the audit's on-page/title budget; no live SERP provider.
  return {
    name: "serp_data",
    available: true,
    provenance: "measured",
    data: {
      title: report.onPage?.title,
      titlePixelWidth: report.onPage?.titlePixelWidth,
      isTitleBudgetCompliant: report.onPage?.isTitleBudgetCompliant,
    },
  };
}

/** llms.txt presence/validity, measured from the live site. */
export function llmsCheckTool(report: AuditReport | null): ToolResult {
  const check = report?.geoAudit?.llmsTxt;
  if (!check) {
    return { name: "llms_check", available: false, provenance: "unavailable", reason: "GEO audit not run", data: null };
  }
  const available = check.status !== "unavailable";
  return {
    name: "llms_check",
    available,
    provenance: available ? "measured" : "unavailable",
    reason: available ? undefined : check.reason ?? "llms.txt could not be fetched",
    data: {
      url: check.url,
      status: check.status,
      httpStatus: check.httpStatus,
      score: check.score,
      title: check.parsed?.title ?? null,
      sections: check.parsed?.sectionCount ?? null,
      links: check.parsed?.linkCount ?? null,
      failedChecks: check.checks.filter((item) => !item.pass).map((item) => item.label),
    },
  };
}

/** Documented 0–100 citability heuristic with its formula and inputs. */
export function citabilityTool(report: AuditReport | null): ToolResult {
  const citability = report?.geoAudit?.citability;
  if (!citability) {
    return { name: "citability", available: false, provenance: "unavailable", reason: "GEO audit not run", data: null };
  }
  return {
    name: "citability",
    available: true,
    provenance: citability.provenance,
    data: {
      score: citability.score,
      formula: citability.formula,
      version: citability.version,
      components: citability.components.map((component) => ({
        id: component.id,
        label: component.label,
        weight: component.weight,
        score: component.score,
        inputs: component.inputs,
      })),
    },
  };
}

/** Drift against the previous stored snapshot for this domain. */
export function driftTool(report: AuditReport | null): ToolResult {
  const drift = report?.geoAudit?.drift;
  if (!drift) {
    return { name: "drift", available: false, provenance: "unavailable", reason: "GEO audit not run", data: null };
  }
  if (drift.status === "no_baseline") {
    return {
      name: "drift",
      available: false,
      provenance: "unavailable",
      reason: "No previous snapshot for this domain, so no drift can be measured.",
      data: drift,
    };
  }
  return { name: "drift", available: true, provenance: drift.provenance, data: drift };
}

/** Latest recorded AI-visibility run (prompts × providers) for this URL. */
export async function visibilityTrackerTool(targetUrl: string): Promise<ToolResult> {
  const run = await latestVisibilityRun(targetUrl).catch(() => null);
  if (!run) {
    return {
      name: "visibility_tracker",
      available: false,
      provenance: "unavailable",
      reason: "No visibility run recorded. Connect a provider key and run the tracker first.",
      data: null,
    };
  }
  const available = run.summary.availableAnswers > 0;
  return {
    name: "visibility_tracker",
    available,
    provenance: available ? "measured" : "unavailable",
    reason: available ? undefined : "No provider returned an answer; all requested surfaces were unavailable.",
    data: {
      runId: run.id,
      finishedAt: run.finishedAt,
      brands: run.brand,
      summary: run.summary,
      results: run.results.map((row) => ({
        promptId: row.promptId,
        prompt: row.prompt,
        provider: row.provider,
        available: row.available,
        reason: row.reason,
        mentioned: row.mentioned,
        ownCitations: row.ownCitations,
        model: row.model,
      })),
    },
  };
}

/** Prompts where the brand is absent, plus reviewable patch plans. */
export function gapDetectorTool(run: VisibilityRun | null): ToolResult {
  if (!run) {
    return {
      name: "gap_detector",
      available: false,
      provenance: "unavailable",
      reason: "No visibility run available for gap analysis.",
      data: null,
    };
  }
  const report = detectGaps(run);
  return {
    name: "gap_detector",
    available: report.measuredPrompts > 0,
    provenance: report.measuredPrompts > 0 ? "measured" : "unavailable",
    reason: report.measuredPrompts > 0 ? undefined : "No prompt had an available answer.",
    data: report,
  };
}
