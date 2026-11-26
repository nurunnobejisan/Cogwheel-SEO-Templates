/**
 * Outcome logging — public surface.
 *
 * Records page changes and measures their Search Console outcomes over matched
 * before/after windows with a control set, so any later impact claim is grounded
 * in measurement. See `docs/OUTCOMES.md`.
 */

import crypto from "node:crypto";
import type { ChangeEvent, OutcomeProvenance } from "./types.ts";

export * from "./types.ts";
export {
  DEFAULT_LEAD_DAYS,
  DEFAULT_WINDOW_DAYS,
  delta,
  findPageMetric,
  isoDay,
  normalizePage,
  planWindows,
  samePage,
  selectControlPages,
  totalsFromRows,
  type PlanWindowsOptions,
  type WindowPlan,
} from "./windows.ts";
export { measureChange, outcomeId, type MeasureDeps } from "./measure.ts";

/**
 * Derive a Search Console property identifier from a page URL. Defaults to the
 * domain property (`sc-domain:host`); pass `override` for a URL-prefix property.
 */
export function gscPropertyFromUrl(pageUrl: string, override?: string): string {
  if (override) return override;
  try {
    const host = new URL(pageUrl).host.replace(/^www\./, "");
    return `sc-domain:${host}`;
  } catch {
    return pageUrl;
  }
}

export interface DeploymentChangeInput {
  pageUrl: string;
  appliedAt: string;
  siteUrl?: string;
  summary?: string;
  kind?: string;
  tenantId?: string;
  fixRef?: string;
  provenance?: OutcomeProvenance;
  id?: string;
}

/**
 * Map a deployed fix (e.g. a platform deployment-history entry) to a
 * `ChangeEvent`. The id is deterministic on page + timestamp so a re-run of the
 * same deployment does not create a duplicate.
 */
export function changeEventFromDeployment(input: DeploymentChangeInput): ChangeEvent {
  const id =
    input.id ??
    `chg_${crypto.createHash("sha256").update(`${input.pageUrl}|${input.appliedAt}`).digest("hex").slice(0, 16)}`;
  return {
    id,
    siteUrl: gscPropertyFromUrl(input.pageUrl, input.siteUrl),
    pageUrl: input.pageUrl,
    kind: input.kind ?? "deployment",
    summary: input.summary ?? `Deployment to ${input.pageUrl}`,
    appliedAt: input.appliedAt,
    tenantId: input.tenantId,
    fixRef: input.fixRef,
    provenance: input.provenance ?? "measured",
  };
}
