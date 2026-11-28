/**
 * SEO Studio Universal SEO Engine — Entry Point
 *
 * Mode-aware audit orchestration:
 *   1. Extract a normalized PageSnapshot (extension DOM pass or HTML fallback).
 *   2. Resolve the execution mode (manual override → automatic detection).
 *   3. Run the Universal ruleset, plus the Hotel ruleset when in Hotel Mode.
 *   4. Emit the standardized AuditReport payload for the AI/CMS layers.
 *
 * Hotel Mode is additive: it runs the Universal ruleset and then layers the
 * hospitality checks on top, so existing hotel workflows keep working.
 */

import type {
  AuditOptions,
  AuditReport,
  ModeOverrideStoreLike,
  PageSnapshot,
  RuleContext,
} from "./types.ts";
import { resolveAuditMode } from "./context/detect-mode.ts";
import { createMemoryOverrideStore } from "./context/mode-override.ts";
import { runUniversalRules } from "./universal/index.ts";
import { runHotelRules } from "./hotel/index.ts";
import { sortIssuesBySeverity, summarizeIssues } from "./issues.ts";

export * from "./types.ts";
export * from "./issues.ts";
export * from "./context/detect-mode.ts";
export * from "./context/mode-override.ts";
export * from "./universal/index.ts";
export * from "./hotel/index.ts";
export * from "./html-snapshot.ts";
export * from "./schema.ts";

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function generateAuditId(snapshot: Pick<PageSnapshot, "url">, now: string): string {
  return `aud_${hashString(`${snapshot.url}|${now}`)}_univ`;
}

/**
 * Run a full mode-aware audit and return the standardized AuditReport payload.
 */
export function runAudit(snapshot: PageSnapshot, options: AuditOptions = {}): AuditReport {
  const now = options.now ?? new Date().toISOString();
  const store: ModeOverrideStoreLike =
    options.overrideStore ?? createMemoryOverrideStore();

  const modeDetection = resolveAuditMode(snapshot, store);
  const ctx: RuleContext = { snapshot, mode: modeDetection.mode, now };

  const issues =
    modeDetection.mode === "hotel"
      ? [...runUniversalRules(ctx), ...runHotelRules(ctx)]
      : runUniversalRules(ctx);

  const ordered = sortIssuesBySeverity(issues);

  return {
    auditId: options.auditId ?? generateAuditId(snapshot, now),
    domain: snapshot.hostname,
    pageUrl: snapshot.url,
    timestamp: now,
    mode: modeDetection.mode,
    modeDetection,
    issues: ordered,
    summary: summarizeIssues(ordered),
  };
}
