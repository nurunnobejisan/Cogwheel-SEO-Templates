/**
 * Fetch + analyze the GEO artifacts for one URL.
 *
 * Network I/O lives here (SSRF-safe egress) so the pure rules stay testable and
 * deterministic. Used by /api/geo/check, the brain tools and drift CLI.
 */

import { assertEgressAllowed, readTextCapped, safeFetch } from "../../lib/security/egress.ts";
import { buildSnapshotFromHtml } from "../../../rules/html-snapshot.ts";
import { collectGeoAudit } from "../../rules/geo/index.ts";
import type { GeoAuditReport, GeoSnapshot } from "../../../rules/geo/types.ts";
import { loadLatestGeoSnapshot, saveGeoSnapshot } from "./drift-store.ts";

const USER_AGENT = "SeoStudioBot/3.0 (+https://example.com/bot)";

export interface RunGeoCheckOptions {
  baseline?: GeoSnapshot | null;
  /** Persist the new snapshot for future drift checks (default true). */
  persist?: boolean;
  driftFailThreshold?: number;
}

export async function runGeoCheck(targetUrl: string, options: RunGeoCheckOptions = {}): Promise<GeoAuditReport> {
  const url = await assertEgressAllowed(targetUrl);
  const parsed = new URL(url);
  const origin = parsed.origin;

  const [page, robots, llms] = await Promise.all([
    safeFetch(url, { method: "GET", headers: { "User-Agent": USER_AGENT } }, { timeoutMs: 15_000 }).catch(() => null),
    safeFetch(`${origin}/robots.txt`, { method: "GET", headers: { "User-Agent": USER_AGENT } }, { timeoutMs: 10_000 }).catch(() => null),
    safeFetch(`${origin}/llms.txt`, { method: "GET", headers: { "User-Agent": USER_AGENT } }, { timeoutMs: 10_000 }).catch(() => null),
  ]);

  const html = page ? await readTextCapped(page.response, 1_500_000).catch(() => "") : "";
  const snapshot = buildSnapshotFromHtml(html, page?.finalUrl ?? url, {
    overrides: { fetchStatus: page?.response.status ?? null },
  });

  const robotsText = robots ? await readTextCapped(robots.response, 500_000).catch(() => "") : "";
  const llmsText = llms ? await readTextCapped(llms.response, 512_000).catch(() => "") : "";

  const baseline = options.baseline === undefined ? await loadLatestGeoSnapshot(parsed.hostname) : options.baseline;
  const report = collectGeoAudit({
    url,
    domain: parsed.hostname,
    snapshot,
    robots: {
      url: `${origin}/robots.txt`,
      statusCode: robots?.response.status ?? null,
      text: robotsText,
      error: robots ? undefined : "robots.txt could not be fetched",
    },
    llms: {
      url: `${origin}/llms.txt`,
      statusCode: llms?.response.status ?? null,
      text: llmsText,
      error: llms ? undefined : "llms.txt could not be fetched",
    },
    baseline,
    driftFailThreshold: options.driftFailThreshold,
  });

  if (options.persist !== false) {
    await saveGeoSnapshot(report.snapshot);
  }
  return report;
}
