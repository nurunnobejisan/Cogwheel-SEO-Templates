/**
 * App-facing GEO orchestration.
 *
 * Pure checks live in `rules/geo/`; this module composes them into one report
 * for the audit engine, the /api/geo/check route and the brain tools. Inputs
 * are the already-fetched artifacts, so this function is deterministic and
 * never performs network I/O itself.
 */

import type { PageSnapshot } from "../../../rules/types.ts";
import {
  buildCitabilityScore,
  checkAiCrawlers,
  createGeoSnapshot,
  diffGeoSnapshots,
  validateLlmsTxt,
  type AiCrawlerCheck,
  type CitabilityComponent,
  type GeoAuditReport,
  type GeoIssue,
  type GeoSnapshot,
  type LlmsTxtCheck,
} from "../../../rules/geo/index.ts";
import { GEO_ENGINE_VERSION } from "../../../rules/geo/types.ts";

export interface GeoArtifactsInput {
  url: string;
  domain: string;
  snapshot: PageSnapshot;
  capturedAt?: string;
  robots: {
    url: string;
    statusCode: number | null;
    text?: string | null;
    error?: string;
  };
  llms: {
    url: string;
    statusCode: number | null;
    text?: string | null;
    error?: string;
  };
  baseline?: GeoSnapshot | null;
  driftFailThreshold?: number;
}

export function collectGeoAudit(input: GeoArtifactsInput): GeoAuditReport {
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  const llmsTxt = validateLlmsTxt({
    url: input.llms.url,
    statusCode: input.llms.statusCode,
    text: input.llms.text,
    error: input.llms.error,
  });
  const aiCrawlers = checkAiCrawlers({
    robotsUrl: input.robots.url,
    statusCode: input.robots.statusCode,
    text: input.robots.text,
    error: input.robots.error,
  });
  const citability = buildCitabilityScore(input.snapshot);
  const schemaTypes = collectSchemaTypes(input.snapshot);
  const issues = buildGeoIssues({ llmsTxt, aiCrawlers, citability });
  const snapshot = createGeoSnapshot({
    url: input.url,
    domain: input.domain,
    capturedAt,
    citability,
    llmsTxt,
    aiCrawlers,
    schemaTypes,
    wordCount: input.snapshot.wordCount,
    issues,
  });
  const drift = diffGeoSnapshots(input.baseline ?? null, snapshot, {
    failThreshold: input.driftFailThreshold,
  });
  if (drift.status === "fail") {
    issues.push({
      id: "geo-drift-regression",
      severity: "high",
      title: "GEO metrics regressed since the last audit",
      description: drift.regressions.join(" "),
      remediation: "Compare the two audit snapshots, identify the removed content/schema or new robots rule, and restore it.",
    });
  }

  return {
    url: input.url,
    domain: input.domain,
    capturedAt,
    version: GEO_ENGINE_VERSION,
    llmsTxt,
    aiCrawlers,
    citability,
    drift,
    issues,
    snapshot,
    provenance: {
      measured: [
        "llmsTxt (HTTP status, Markdown structure, links, size)",
        "aiCrawlers (robots.txt user-agent groups for AI crawlers)",
        "citability.inputs (schema types, headings, words, links, statistics, quotations)",
      ],
      estimated: [
        "citability.score (documented weighted heuristic; not an AI-citation measurement)",
        "drift (comparison of audit snapshots)",
      ],
      unavailable:
        llmsTxt.status === "unavailable" || aiCrawlers.status === "unavailable"
          ? ["One or more GEO artifacts could not be fetched; those checks are labelled unavailable."]
          : [],
    },
  };
}

function collectSchemaTypes(snapshot: PageSnapshot): string[] {
  const types = new Set<string>();
  for (const node of snapshot.jsonLd) {
    const type = node["@type"];
    if (typeof type === "string") types.add(type);
    else if (Array.isArray(type)) for (const entry of type) if (typeof entry === "string") types.add(entry);
  }
  return [...types];
}

function buildGeoIssues(input: {
  llmsTxt: LlmsTxtCheck;
  aiCrawlers: AiCrawlerCheck;
  citability: ReturnType<typeof buildCitabilityScore>;
}): GeoIssue[] {
  const issues: GeoIssue[] = [];

  if (input.llmsTxt.status === "absent") {
    issues.push({
      id: "geo-llms-txt-missing",
      severity: "medium",
      title: "Publish /llms.txt",
      description: "No llms.txt was found at the site root (HTTP 404).",
      remediation:
        "Add a Markdown /llms.txt with an H1 project name, a one-line blockquote summary, and ## sections linking to the most citable pages.",
    });
  } else if (input.llmsTxt.status === "invalid") {
    issues.push({
      id: "geo-llms-txt-invalid",
      severity: "low",
      title: "Fix llms.txt structure",
      description: input.llmsTxt.checks
        .filter((check) => !check.pass)
        .map((check) => `${check.label}: ${check.detail}`)
        .join("; "),
      remediation: "Keep the H1, summary, sections and absolute links required by the llms.txt format.",
    });
  }

  if (input.aiCrawlers.blockedBots.length > 0) {
    const major = input.aiCrawlers.blockedBots.filter((bot) =>
      ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "OAI-SearchBot"].includes(bot)
    );
    issues.push({
      id: "geo-ai-crawlers-blocked",
      severity: major.length > 0 ? "high" : "medium",
      title: "Allow AI crawlers in robots.txt",
      description: `robots.txt blocks: ${input.aiCrawlers.blockedBots.join(", ")}.`,
      remediation:
        "If AI search visibility is intended, add explicit Allow rules for the crawlers you want to admit (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended) and keep private paths disallowed.",
    });
  }

  if (input.aiCrawlers.status === "unavailable" || input.llmsTxt.status === "unavailable") {
    issues.push({
      id: "geo-artifact-unavailable",
      severity: "info",
      title: "Some GEO checks could not be measured",
      description: "robots.txt or llms.txt could not be fetched, so those checks are not scored.",
      remediation: "Re-run the audit when the site is reachable; do not infer a pass or fail.",
    });
  }

  const { score } = input.citability;
  if (score < 40) {
    issues.push({
      id: "geo-citability-low",
      severity: "high",
      title: "Citability score is low",
      description: `Citability is ${score}/100. ${weakestComponents(input.citability.components)}`,
      remediation:
        "Prioritise structured data (FAQPage + Organization/LodgingBusiness), question-style H2s with 40–60 word answers, and cited statistics or quotations.",
    });
  } else if (score < 60) {
    issues.push({
      id: "geo-citability-mid",
      severity: "medium",
      title: "Citability can be improved",
      description: `Citability is ${score}/100. ${weakestComponents(input.citability.components)}`,
      remediation: "Strengthen the weakest components listed above; add direct answers and entity schema.",
    });
  } else if (score < 75) {
    issues.push({
      id: "geo-citability-fair",
      severity: "low",
      title: "Citability is fair",
      description: `Citability is ${score}/100. ${weakestComponents(input.citability.components)}`,
      remediation: "Improve the weakest component with source-backed facts and clearer answer blocks.",
    });
  }

  return issues;
}

function weakestComponents(components: CitabilityComponent[]): string {
  return components
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((component) => `${component.label} ${component.score}/100`)
    .join("; ");
}
