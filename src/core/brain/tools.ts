import "server-only";

import { runFullWebsiteAudit } from "@/core/full-audit";
import { performKeywordResearch } from "@/core/open-seo/keyword-research";

export interface ToolResult<T = unknown> {
  name: string;
  available: boolean;
  reason?: string;
  data: T | null;
}

export async function fullAuditTool(targetUrl: string, maxPages = 10): Promise<ToolResult<Awaited<ReturnType<typeof runFullWebsiteAudit>>>> {
  try {
    const report = await runFullWebsiteAudit({ targetUrl, maxPages, includeGsc: true, includeGeo: true });
    return { name: "full_audit", available: true, data: report };
  } catch (err) {
    return { name: "full_audit", available: false, reason: String(err), data: null };
  }
}

export function schemaCheckTool(report: Awaited<ReturnType<typeof runFullWebsiteAudit>> | null): ToolResult {
  if (!report) return { name: "schema_check", available: false, reason: "no audit", data: null };
  return { name: "schema_check", available: true, data: report.schemaValidation };
}

export function keywordResearchTool(seedTerm: string): ToolResult {
  const result = performKeywordResearch(seedTerm);
  const available = result.dataSource === "provider";
  return {
    name: "keyword_research",
    available,
    reason: available ? undefined : `data source: ${result.dataSource}`,
    data: result,
  };
}

export function searchConsoleTool(report: Awaited<ReturnType<typeof runFullWebsiteAudit>> | null): ToolResult {
  if (!report) return { name: "search_console", available: false, reason: "no audit", data: null };
  const sc = report.searchConsole;
  const available = Boolean(sc?.isConnected);
  return { name: "search_console", available, reason: available ? undefined : "Google Search Console not connected", data: sc };
}

export function serpDataTool(report: Awaited<ReturnType<typeof runFullWebsiteAudit>> | null): ToolResult {
  if (!report) return { name: "serp_data", available: false, reason: "no audit", data: null };
  // SERP data is derived from the audit's onPage/title budget; no live SERP provider.
  return { name: "serp_data", available: true, data: { title: report.onPage?.title, titlePixelWidth: report.onPage?.titlePixelWidth, isTitleBudgetCompliant: report.onPage?.isTitleBudgetCompliant } };
}
