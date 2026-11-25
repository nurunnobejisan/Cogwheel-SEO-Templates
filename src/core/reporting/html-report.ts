/**
 * Self-contained HTML audit report.
 *
 * Print-ready: the page includes `@media print` rules so "Save as PDF" from a
 * browser produces a clean deliverable. Every number shown is copied from the
 * audit payload; unavailable dimensions are labelled, never filled in.
 */

import type { FullWebsiteAuditReport } from "../full-audit/types.ts";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function scoreClass(score: number): string {
  if (score >= 80) return "good";
  if (score >= 60) return "warn";
  return "bad";
}

function scoreRow(label: string, score: number): string {
  return `<tr><th>${escapeHtml(label)}</th><td><span class="pill ${scoreClass(score)}">${score}</span></td></tr>`;
}

function unavailableRow(label: string, available: boolean, detail: string): string {
  return available
    ? `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(detail)}</td></tr>`
    : `<tr><th>${escapeHtml(label)}</th><td class="muted">Not available — ${escapeHtml(detail)}</td></tr>`;
}

export function buildAuditHtmlReport(report: FullWebsiteAuditReport): string {
  const r = report;
  const prov = r.dataProvenance;
  const topActions = [...r.actionPlan].sort((a, b) => a.priority.localeCompare(b.priority)).slice(0, 10);

  const actionRows = topActions
    .map(
      (item) => `<tr>
        <td><span class="pill ${item.priority === "P0" ? "bad" : item.priority === "P1" ? "warn" : "neutral"}">${escapeHtml(item.priority)}</span></td>
        <td><strong>${escapeHtml(item.title)}</strong><br><span class="muted">${escapeHtml(item.description)}</span></td>
        <td>${escapeHtml(item.impact)}</td>
        <td>${escapeHtml(item.effort)}</td>
      </tr>`,
    )
    .join("");

  const gsc = r.searchConsole;
  const keywords = r.keywordsAndGaps;
  const geo = r.aiGeoVisibility;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SEO Audit — ${escapeHtml(r.domain)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #f8fafc; }
  .page { max-width: 960px; margin: 0 auto; padding: 40px 32px 64px; background: #fff; }
  header { border-bottom: 3px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
  h1 { margin: 0 0 6px; font-size: 26px; letter-spacing: -0.02em; }
  h2 { margin: 32px 0 12px; font-size: 17px; text-transform: uppercase; letter-spacing: 0.06em; color: #334155; }
  h3 { margin: 18px 0 8px; font-size: 14px; }
  p, li, td, th { font-size: 12.5px; line-height: 1.55; }
  .meta { color: #64748b; font-size: 12px; }
  .hero { display: flex; gap: 24px; flex-wrap: wrap; align-items: center; justify-content: space-between; background: #f1f5f9; border-radius: 12px; padding: 18px 20px; }
  .score { font-size: 40px; font-weight: 800; line-height: 1; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 4px; }
  th, td { text-align: left; vertical-align: top; padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
  th { width: 38%; font-weight: 600; color: #334155; }
  .pill { display: inline-block; min-width: 34px; text-align: center; border-radius: 999px; padding: 2px 8px; font-size: 11px; font-weight: 700; }
  .good { background: #dcfce7; color: #166534; }
  .warn { background: #fef3c7; color: #92400e; }
  .bad { background: #fee2e2; color: #991b1b; }
  .neutral { background: #e2e8f0; color: #334155; }
  .muted { color: #64748b; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
  .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; }
  .note { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 12px 14px; font-size: 12px; }
  ul { margin: 6px 0; padding-left: 18px; }
  footer { margin-top: 36px; border-top: 1px solid #e2e8f0; padding-top: 12px; color: #64748b; font-size: 11px; }
  @media print {
    body { background: #fff; }
    .page { max-width: none; padding: 0; }
    h2 { break-after: avoid; }
    tr, .card { break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="page">
  <header>
    <h1>SEO &amp; GEO Audit — ${escapeHtml(r.domain)}</h1>
    <div class="meta">${escapeHtml(r.targetUrl)} · ${escapeHtml(new Date(r.createdAt).toUTCString())} · Report ${escapeHtml(r.id)}</div>
  </header>

  <div class="hero">
    <div>
      <div class="meta">Overall score</div>
      <div class="score">${r.overallScore}<span style="font-size:16px;color:#64748b">/100</span></div>
    </div>
    <table style="width:auto">
      ${scoreRow("Technical", r.scores.technical)}
      ${scoreRow("On-page", r.scores.onPage)}
      ${scoreRow("Headings", r.scores.headings)}
      ${scoreRow("Images", r.scores.images)}
      ${scoreRow("Schema", r.scores.schema)}
      ${scoreRow("AI / GEO readiness", r.scores.aiVisibility)}
    </table>
  </div>

  <h2>Executive summary</h2>
  <div class="grid">
    <div class="card">
      <h3>Technical</h3>
      <ul>
        <li>HTTP status: ${r.technicalHealth.statusCode} · ${r.technicalHealth.responseTimeMs} ms</li>
        <li>HTTPS: ${r.technicalHealth.isHttps ? "yes" : "no"} · compression: ${r.technicalHealth.hasCompression ? "yes" : "no"}</li>
        <li>Server: ${escapeHtml(r.technicalHealth.server || "not disclosed")}</li>
      </ul>
    </div>
    <div class="card">
      <h3>Crawlability</h3>
      <ul>
        <li>Indexable: ${r.crawlability.isIndexable ? "yes" : "no"} · noindex: ${r.crawlability.hasNoindex ? "yes" : "no"}</li>
        <li>robots.txt: ${r.crawlability.hasRobotsTxt ? "found" : "not found"} · sitemaps: ${r.crawlability.discoveredSitemaps.length}</li>
        <li>Links: ${r.crawlability.totalInternalLinksDiscovered} internal / ${r.crawlability.totalExternalLinksDiscovered} external</li>
      </ul>
    </div>
    <div class="card">
      <h3>On-page</h3>
      <ul>
        <li>Title: ${escapeHtml(r.onPage.title || "(missing)")} — ${r.onPage.titleLength} chars / ${r.onPage.titlePixelWidth}px</li>
        <li>Meta: ${r.onPage.metaDescriptionLength} chars · words: ${r.onPage.wordCount}</li>
        <li>Headings: ${r.headings.totalHeadings} total · H1 count: ${r.headings.h1Count}</li>
      </ul>
    </div>
    <div class="card">
      <h3>Images &amp; schema</h3>
      <ul>
        <li>Images: ${r.images.totalImages} · missing alt: ${r.images.missingAltCount}</li>
        <li>Schemas: ${escapeHtml(r.schemaValidation.schemasDetected.join(", ") || "none detected")}</li>
        <li>Rich result eligible: ${r.schemaValidation.richSnippetEligible ? "yes" : "no"}</li>
      </ul>
    </div>
  </div>

  <h2>Data sources</h2>
  ${unavailableRow("Search Console", gsc.isConnected, gsc.isConnected ? `${gsc.totalClicks} clicks / ${gsc.totalImpressions} impressions (${gsc.periodDays}d)` : "connect Google Search Console credentials")}
  ${unavailableRow("Keyword volumes", keywords.totalTargetKeywords > 0, keywords.totalTargetKeywords > 0 ? `${keywords.totalTargetKeywords} keywords tracked` : "no keyword-volume provider connected")}
  ${unavailableRow("AI / GEO citations", geo.dataAvailable, geo.dataAvailable ? `${geo.estimatedCitationsAcrossEngines.googleAiOverviews + geo.estimatedCitationsAcrossEngines.perplexity + geo.estimatedCitationsAcrossEngines.chatgptSearch + geo.estimatedCitationsAcrossEngines.claude} citations across engines` : "no AI engine was queried — score is on-page readiness only")}
  <p class="muted">${escapeHtml(geo.methodology)}</p>

  <h2>Action plan</h2>
  ${topActions.length > 0 ? `<table><thead><tr><th>Priority</th><th>Action</th><th>Impact</th><th>Effort</th></tr></thead><tbody>${actionRows}</tbody></table>` : `<p class="muted">No issues were raised by the rules engine.</p>`}

  <h2>Provenance</h2>
  <div class="grid">
    <div class="card">
      <h3>Measured</h3>
      <ul>${prov.measured.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
    <div class="card">
      <h3>Estimated</h3>
      <ul>${prov.estimated.length > 0 ? prov.estimated.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : `<li class="muted">None</li>`}</ul>
    </div>
    <div class="card">
      <h3>Unavailable</h3>
      <ul>${prov.unavailable.length > 0 ? prov.unavailable.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : `<li class="muted">None</li>`}</ul>
    </div>
  </div>
  ${prov.simulated ? `<div class="note"><strong>Simulated data enabled.</strong> Some values in this report come from the bundled demo dataset (ALLOW_SIMULATED_DATA=1), not from live sources.</div>` : ""}
  <ul>${prov.notes.map((note) => `<li class="muted">${escapeHtml(note)}</li>`).join("")}</ul>

  <footer>
    Generated by Cogwheel SEO Studio. Scores are derived from the live page and the bundled rules engine.
    Unavailable data sources are labelled rather than estimated; they are never replaced with placeholder numbers.
  </footer>
</div>
</body>
</html>`;
}