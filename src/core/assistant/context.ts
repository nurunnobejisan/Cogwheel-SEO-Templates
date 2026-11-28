import "server-only";

import { getPipeline } from "@/core/brain";
import type { FullWebsiteAuditReport } from "@/core/full-audit/types";
import type { GscPanelPayload } from "@/core/gsc/panel-types.ts";
import type { VisibilityRun } from "@/core/visibility/types.ts";

export const ASSISTANT_SYSTEM_PROMPT = `You are the Audit Assistant inside SEO & GEO Studio.

You answer ONLY from the supplied measured context: the current audit report, the attached Search Console panel, stored visibility runs, and retrieved knowledge-base chunks.

HARD CONSTRAINTS:
1. Never invent rankings, search volumes, clicks, impressions, AI citations, competitor names, fees, or benchmark scores.
2. Every number must appear in the supplied context. If a dimension is unavailable or unmeasured, say so plainly.
3. Cite retrieved chunk ids in brackets, e.g. [kc-title-tag]. A source called "unavailable" is not evidence.
4. Keep web-grounded citations separate from model-memory mentions.
5. Answer concisely in markdown. Prefer "not measured" over a plausible estimate.`;

export interface AssistantContextInput {
  targetUrl: string;
  question: string;
  report: FullWebsiteAuditReport | null;
  gscPanel?: GscPanelPayload | null;
  visibilityRun?: VisibilityRun | null;
}

export interface AssistantChunk {
  id?: string;
  title?: string;
  text?: string;
}

export interface AssistantContext {
  system: string;
  prompt: string;
  sources: AssistantChunk[];
  retrieved: Array<{ id: string; title: string; source: string; score: number; text: string }>;
}

export async function buildAssistantContext(input: AssistantContextInput): Promise<AssistantContext> {
  const pipeline = await getPipeline();
  const retrieved = pipeline.knowledgeBase.search(input.question, { topK: 6 }).map((chunk) => ({
    id: String(chunk.id),
    title: String(chunk.title ?? ""),
    source: String(chunk.source ?? ""),
    score: Number(chunk.score ?? 0),
    text: String(chunk.text ?? ""),
  }));

  const report = input.report;
  const compactReport = report
    ? {
        targetUrl: report.targetUrl,
        domain: report.domain,
        overallScore: report.overallScore,
        scores: report.scores,
        provenance: report.dataProvenance,
        searchConsole: {
          isConnected: report.searchConsole.isConnected,
          siteUrl: report.searchConsole.siteUrl,
          periodDays: report.searchConsole.periodDays,
          totalClicks: report.searchConsole.totalClicks,
          totalImpressions: report.searchConsole.totalImpressions,
          averageCtr: report.searchConsole.averageCtr,
          averagePosition: report.searchConsole.averagePosition,
          cannibalizationDetectedCount: report.searchConsole.cannibalizationDetectedCount,
        },
        headings: report.headings,
        images: report.images,
        technicalHealth: report.technicalHealth,
        crawlability: report.crawlability,
        aiGeoVisibility: {
          visibilityScore: report.aiGeoVisibility.visibilityScore,
          dataAvailable: report.aiGeoVisibility.dataAvailable,
          methodology: report.aiGeoVisibility.methodology,
          recommendations: report.aiGeoVisibility.recommendations.slice(0, 6),
        },
        algorithmImpact: {
          riskRating: report.algorithmImpact.riskRating,
          potentiallyImpactedByRecentUpdates: report.algorithmImpact.potentiallyImpactedByRecentUpdates,
          recentRelevantUpdates: report.algorithmImpact.recentRelevantUpdates,
        },
        topActions: [...report.actionPlan]
          .sort((a, b) => a.priority.localeCompare(b.priority))
          .slice(0, 12)
          .map((action) => ({ priority: action.priority, title: action.title, description: action.description })),
      }
    : null;

  const gscChunk = input.gscPanel
    ? {
        id: "gsc-panel",
        title: `Search Console panel (${input.gscPanel.source})`,
        text: JSON.stringify({
          siteUrl: input.gscPanel.siteUrl,
          window: input.gscPanel.window,
          dataState: input.gscPanel.dataState,
          overview: {
            totalClicks: input.gscPanel.overview.totalClicks,
            totalImpressions: input.gscPanel.overview.totalImpressions,
            averageCtr: input.gscPanel.overview.averageCtr,
            averagePosition: input.gscPanel.overview.averagePosition,
          },
          comparison: input.gscPanel.comparison,
          cannibalization: input.gscPanel.cannibalization.slice(0, 10),
          limitations: input.gscPanel.limitations,
        }),
      }
    : {
        id: "gsc-panel",
        title: "Search Console panel",
        text: "No Search Console panel is attached. Query-level clicks, impressions and cannibalization are not measured for this answer.",
      };

  const visibilityChunk = input.visibilityRun
    ? {
        id: "visibility-run",
        title: "Latest measured visibility run",
        text: JSON.stringify({
          targetUrl: input.visibilityRun.targetUrl,
          finishedAt: input.visibilityRun.finishedAt,
          summary: input.visibilityRun.summary,
          results: input.visibilityRun.results.slice(0, 20).map((row) => ({
            provider: row.provider,
            prompt: row.prompt,
            available: row.available,
            reason: row.reason,
            mentioned: row.mentioned,
            citationType: row.citationType,
            ownCitations: row.ownCitations,
          })),
        }),
      }
    : {
        id: "visibility-run",
        title: "AI visibility run",
        text: "No visibility run has been measured for this URL. Mention rates and citation counts are unavailable.",
      };

  const sources: AssistantChunk[] = [
    { id: "audit-report", title: "Current audit report", text: JSON.stringify(compactReport ?? { unavailable: true }) },
    gscChunk,
    visibilityChunk,
    ...retrieved.map((chunk) => ({ id: chunk.id, title: chunk.title, text: chunk.text })),
  ];

  const prompt = [
    `TARGET URL: ${input.targetUrl}`,
    `QUESTION: ${input.question}`,
    "",
    "AUDIT REPORT (measured fields only; null means unavailable):",
    JSON.stringify(compactReport, null, 2),
    "",
    "SEARCH CONSOLE PANEL:",
    gscChunk.text,
    "",
    "AI / GEO VISIBILITY RUN:",
    visibilityChunk.text,
    "",
    "RETRIEVED KNOWLEDGE (cite ids in brackets when used):",
    retrieved.length
      ? retrieved.map((chunk) => `[${chunk.id}] ${chunk.title} (${chunk.source})\n${chunk.text}`).join("\n\n")
      : "No knowledge-base chunks matched; limit recommendations to measured fields.",
    "",
    "Answer the question now. If a source above says unavailable, repeat that plainly instead of estimating.",
  ].join("\n");

  return { system: ASSISTANT_SYSTEM_PROMPT, prompt, sources, retrieved };
}
