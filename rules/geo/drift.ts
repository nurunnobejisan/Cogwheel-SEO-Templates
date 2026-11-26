/**
 * Drift between GEO audits.
 *
 * A snapshot is deliberately small and stable so it can be committed as a CI
 * artifact. `failThreshold` is the citability-point drop that fails a build;
 * newly blocked AI crawlers, a lost llms.txt, and schema/word-count losses are
 * also reported as regressions.
 */

import type {
  AiCrawlerCheck,
  CitabilityScore,
  DriftCheck,
  DriftDelta,
  GeoIssue,
  GeoSnapshot,
  LlmsTxtCheck,
} from "./types.ts";
import { GEO_ENGINE_VERSION } from "./types.ts";

export const DEFAULT_DRIFT_FAIL_THRESHOLD = 5;

export interface SnapshotInput {
  url: string;
  domain: string;
  capturedAt: string;
  citability: CitabilityScore;
  llmsTxt: LlmsTxtCheck;
  aiCrawlers: AiCrawlerCheck;
  schemaTypes: string[];
  wordCount: number;
  issues: GeoIssue[];
}

export function createGeoSnapshot(input: SnapshotInput): GeoSnapshot {
  return {
    version: GEO_ENGINE_VERSION,
    url: input.url,
    domain: input.domain,
    capturedAt: input.capturedAt,
    citabilityScore: input.citability.score,
    citabilityComponents: Object.fromEntries(
      input.citability.components.map((component) => [component.id, component.score])
    ),
    llmsTxtStatus: input.llmsTxt.status,
    llmsTxtScore: input.llmsTxt.score,
    robotsStatus: input.aiCrawlers.status,
    blockedBots: [...input.aiCrawlers.blockedBots].sort(),
    schemaTypes: [...input.schemaTypes].sort(),
    wordCount: input.wordCount,
    issueIds: input.issues.map((issue) => issue.id).sort(),
  };
}

function numericDelta(metric: string, before: number | null, after: number | null): DriftDelta {
  const change = before === null || after === null ? null : after - before;
  const direction = change === null || change === 0 ? (change === 0 ? "flat" : "changed") : change > 0 ? "up" : "down";
  return { metric, before, after, change, direction };
}

function statusDelta(metric: string, before: string | null, after: string | null): DriftDelta {
  return {
    metric,
    before,
    after,
    change: null,
    direction: before === after ? "flat" : "changed",
  };
}

const LLMS_RANK: Record<string, number> = { unavailable: -1, absent: 0, invalid: 1, present: 2 };

export function diffGeoSnapshots(
  baseline: GeoSnapshot | null,
  current: GeoSnapshot,
  options: { failThreshold?: number } = {}
): DriftCheck {
  const failThreshold = options.failThreshold ?? DEFAULT_DRIFT_FAIL_THRESHOLD;
  if (!baseline) {
    return {
      id: "drift",
      label: "Drift since last audit",
      provenance: "estimated",
      status: "no_baseline",
      failThreshold,
      baselineCapturedAt: null,
      currentCapturedAt: current.capturedAt,
      scoreDelta: null,
      deltas: [],
      regressions: [],
      reason: "No previous snapshot for this domain.",
    };
  }

  const regressions: string[] = [];
  const scoreDelta = current.citabilityScore - baseline.citabilityScore;
  if (scoreDelta <= -failThreshold) {
    regressions.push(`Citability dropped ${Math.abs(scoreDelta)} points (threshold ${failThreshold}).`);
  }

  if ((LLMS_RANK[current.llmsTxtStatus] ?? 0) < (LLMS_RANK[baseline.llmsTxtStatus] ?? 0)) {
    regressions.push(`llms.txt regressed from ${baseline.llmsTxtStatus} to ${current.llmsTxtStatus}.`);
  }

  const newlyBlocked = current.blockedBots.filter((bot) => !baseline.blockedBots.includes(bot));
  if (newlyBlocked.length > 0) {
    regressions.push(`Newly blocked AI crawler(s): ${newlyBlocked.join(", ")}.`);
  }

  const lostSchemas = baseline.schemaTypes.filter((type) => !current.schemaTypes.includes(type));
  if (lostSchemas.length > 0) {
    regressions.push(`Structured-data types removed: ${lostSchemas.join(", ")}.`);
  }

  if (baseline.wordCount >= 300 && current.wordCount < baseline.wordCount * 0.8) {
    regressions.push(`Body copy shrank from ${baseline.wordCount} to ${current.wordCount} words.`);
  }

  const deltas: DriftDelta[] = [
    numericDelta("citabilityScore", baseline.citabilityScore, current.citabilityScore),
    statusDelta("llmsTxtStatus", baseline.llmsTxtStatus, current.llmsTxtStatus),
    numericDelta("llmsTxtScore", baseline.llmsTxtScore, current.llmsTxtScore),
    numericDelta("blockedBotCount", baseline.blockedBots.length, current.blockedBots.length),
    numericDelta("schemaTypeCount", baseline.schemaTypes.length, current.schemaTypes.length),
    numericDelta("wordCount", baseline.wordCount, current.wordCount),
  ];

  for (const id of Object.keys(current.citabilityComponents)) {
    const before = baseline.citabilityComponents[id] ?? null;
    const after = current.citabilityComponents[id] ?? null;
    if (before !== after) {
      deltas.push(numericDelta(`component.${id}`, before, after));
    }
  }

  return {
    id: "drift",
    label: "Drift since last audit",
    provenance: "estimated",
    status: regressions.length > 0 ? "fail" : "pass",
    failThreshold,
    baselineCapturedAt: baseline.capturedAt,
    currentCapturedAt: current.capturedAt,
    scoreDelta,
    deltas,
    regressions,
  };
}
