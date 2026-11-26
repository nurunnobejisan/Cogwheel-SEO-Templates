/**
 * GEO audit primitives.
 *
 * Every value carries a provenance label:
 *   - measured    — parsed from a live fetch (robots.txt, llms.txt, page HTML)
 *   - estimated   — documented deterministic heuristic over measured inputs
 *   - unavailable — the source needed to measure this dimension is not connected
 *
 * Scores expose their formula and inputs so the UI and the brain can cite them.
 */

export type Provenance = "measured" | "estimated" | "unavailable";

export interface CheckDetail {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export type LlmsTxtStatus = "present" | "absent" | "invalid" | "unavailable";

export interface LlmsTxtCheck {
  id: "llms_txt";
  label: string;
  provenance: Provenance;
  url: string;
  status: LlmsTxtStatus;
  httpStatus: number | null;
  /** 0–100 validity score; 0 when absent, null when unavailable. */
  score: number | null;
  checks: CheckDetail[];
  parsed: {
    title: string | null;
    summary: string | null;
    sectionCount: number;
    linkCount: number;
    bytes: number;
  } | null;
  reason?: string;
}

export type CrawlerStatus = "allowed" | "blocked" | "unmentioned";

export interface CrawlerRuleResult {
  bot: string;
  status: CrawlerStatus;
  matchedRule: string | null;
  matchedGroup: string | null;
}

export type RobotsStatus = "present" | "absent" | "unavailable";

export interface AiCrawlerCheck {
  id: "ai_crawlers";
  label: string;
  provenance: Provenance;
  robotsUrl: string;
  status: RobotsStatus;
  bots: CrawlerRuleResult[];
  blockedBots: string[];
  allowedBots: string[];
  unmentionedBots: string[];
  reason?: string;
}

export interface CitabilityComponent {
  id: "structured_data" | "answer_coverage" | "entity_signals" | "content_depth" | "citations";
  label: string;
  weight: number;
  /** 0–100 sub-score. */
  score: number;
  provenance: Provenance;
  inputs: Record<string, number | string | boolean | string[]>;
  notes: string[];
}

export interface CitabilityScore {
  id: "citability";
  label: string;
  /** 0–100 weighted score. */
  score: number;
  provenance: Provenance;
  formula: string;
  components: CitabilityComponent[];
  /** Bumped whenever weights or inputs change, so drift is interpretable. */
  version: string;
}

export interface GeoIssue {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  remediation: string;
}

/** Compact, stable snapshot used for drift comparison between audits. */
export interface GeoSnapshot {
  version: string;
  url: string;
  domain: string;
  capturedAt: string;
  citabilityScore: number;
  citabilityComponents: Record<string, number>;
  llmsTxtStatus: LlmsTxtStatus;
  llmsTxtScore: number | null;
  robotsStatus: RobotsStatus;
  blockedBots: string[];
  schemaTypes: string[];
  wordCount: number;
  issueIds: string[];
}

export interface DriftDelta {
  metric: string;
  before: number | string | null;
  after: number | string | null;
  change: number | null;
  direction: "up" | "down" | "flat" | "changed";
}

export interface DriftCheck {
  id: "drift";
  label: string;
  provenance: Provenance;
  status: "pass" | "fail" | "no_baseline";
  /** A score drop of this many points fails the check. */
  failThreshold: number;
  baselineCapturedAt: string | null;
  currentCapturedAt: string;
  scoreDelta: number | null;
  deltas: DriftDelta[];
  regressions: string[];
  reason?: string;
}

export interface GeoAuditReport {
  url: string;
  domain: string;
  capturedAt: string;
  version: string;
  llmsTxt: LlmsTxtCheck;
  aiCrawlers: AiCrawlerCheck;
  citability: CitabilityScore;
  drift: DriftCheck;
  issues: GeoIssue[];
  snapshot: GeoSnapshot;
  provenance: {
    measured: string[];
    estimated: string[];
    unavailable: string[];
  };
}

/** Canonical list of AI crawlers we report on. */
export const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "anthropic-ai",
  "Claude-Web",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Bytespider",
  "meta-externalagent",
] as const;

export const GEO_ENGINE_VERSION = "geo-audit/1.0.0";
