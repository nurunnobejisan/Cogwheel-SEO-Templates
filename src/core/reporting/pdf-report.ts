/**
 * Minimal, dependency-free PDF report writer.
 *
 * Emits a valid PDF 1.4 document using the built-in Helvetica fonts. It is
 * intentionally text-only (no images/vector charts): the goal is a portable,
 * faithful deliverable, not a design showcase. For pixel-perfect layout use the
 * HTML report and the browser's "Save as PDF".
 */

import type { FullWebsiteAuditReport } from "../full-audit/types.ts";

type Font = "regular" | "bold";

interface Line {
  text: string;
  font?: Font;
  size?: number;
  gapAfter?: number;
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/** Transliterates characters the standard PDF fonts cannot encode. */
function toPdfText(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/[^\x20-\x7E]/g, "");
}

function escapePdf(value: string): string {
  return toPdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(text: string, size: number): string[] {
  const maxChars = Math.max(24, Math.floor(CONTENT_WIDTH / (size * 0.5)));
  const words = toPdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (`${current} ${word}`.length <= maxChars) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function scoreBand(score: number): string {
  if (score >= 80) return "Good";
  if (score >= 60) return "Needs work";
  return "Poor";
}

function buildLines(report: FullWebsiteAuditReport): Line[] {
  const r = report;
  const lines: Line[] = [];
  const push = (text: string, font: Font = "regular", size = 10, gapAfter = 2) => {
    for (const part of wrap(text, size)) {
      lines.push({ text: part, font, size, gapAfter });
    }
  };
  const heading = (text: string) => {
    lines.push({ text: "", size: 6, gapAfter: 0 });
    push(text.toUpperCase(), "bold", 12, 6);
  };

  push("SEO & GEO Audit Report", "bold", 20, 4);
  push(r.targetUrl, "regular", 10, 2);
  push(`Generated ${new Date(r.createdAt).toUTCString()} · Report ${r.id}`, "regular", 9, 12);

  push(`Overall score: ${r.overallScore}/100 (${scoreBand(r.overallScore)})`, "bold", 14, 8);
  push(
    `Technical ${r.scores.technical} · On-page ${r.scores.onPage} · Headings ${r.scores.headings} · ` +
      `Images ${r.scores.images} · Schema ${r.scores.schema} · GEO readiness ${r.scores.aiVisibility}`,
    "regular",
    10,
    10,
  );

  heading("Technical health");
  push(`HTTP status: ${r.technicalHealth.statusCode}`);
  push(`Response time: ${r.technicalHealth.responseTimeMs} ms`);
  push(`HTTPS: ${r.technicalHealth.isHttps ? "yes" : "no"} · SSL valid: ${r.technicalHealth.sslValid ? "yes" : "no"}`);
  push(`Compression: ${r.technicalHealth.hasCompression ? "yes" : "no"} · Server: ${r.technicalHealth.server || "not disclosed"}`);
  push(
    `Security headers — HSTS: ${r.technicalHealth.securityHeaders.hasHsts ? "yes" : "no"}, ` +
      `CSP: ${r.technicalHealth.securityHeaders.hasCsp ? "yes" : "no"}, ` +
      `X-Frame-Options: ${r.technicalHealth.securityHeaders.hasXFrameOptions ? "yes" : "no"}, ` +
      `X-Content-Type-Options: ${r.technicalHealth.securityHeaders.hasXContentTypeOptions ? "yes" : "no"}`,
  );

  heading("Crawlability & indexability");
  push(`Indexable: ${r.crawlability.isIndexable ? "yes" : "no"} · noindex: ${r.crawlability.hasNoindex ? "yes" : "no"} · nofollow: ${r.crawlability.hasNofollow ? "yes" : "no"}`);
  push(`robots.txt: ${r.crawlability.hasRobotsTxt ? r.crawlability.robotsTxtUrl : "not found"}`);
  push(`Sitemaps discovered: ${r.crawlability.discoveredSitemaps.length > 0 ? r.crawlability.discoveredSitemaps.join(", ") : "none"}`);
  push(`Canonical: ${r.crawlability.canonicalUrl ?? "not set"} (self-referencing: ${r.crawlability.isCanonicalSelfReferencing ? "yes" : "no"})`);
  push(`Links: ${r.crawlability.totalInternalLinksDiscovered} internal / ${r.crawlability.totalExternalLinksDiscovered} external`);

  heading("On-page & content");
  push(`Title: ${r.onPage.title || "(missing)"}`);
  push(`Title length: ${r.onPage.titleLength} chars / ${r.onPage.titlePixelWidth}px · compliant: ${r.onPage.isTitleBudgetCompliant ? "yes" : "no"}`);
  push(`Meta description: ${r.onPage.metaDescription || "(missing)"}`);
  push(`Meta length: ${r.onPage.metaDescriptionLength} chars · compliant: ${r.onPage.isMetaBudgetCompliant ? "yes" : "no"}`);
  push(`Word count: ${r.onPage.wordCount} · reading time: ${r.onPage.readingTimeMinutes} min · language: ${r.onPage.primaryLanguage}`);
  push(`Headings: ${r.headings.totalHeadings} total (H1 ${r.headings.h1Count}, H2 ${r.headings.h2Count}, H3 ${r.headings.h3Count}, H4 ${r.headings.h4Count}, H5 ${r.headings.h5Count}, H6 ${r.headings.h6Count})`);
  push(`Hierarchy valid: ${r.headings.hierarchyValid ? "yes" : "no"} · heading issues: ${r.headings.issuesCount}`);

  heading("Images & structured data");
  push(`Images: ${r.images.totalImages} · missing alt: ${r.images.missingAltCount} · oversized: ${r.images.oversizedCount} · legacy formats: ${r.images.legacyFormatCount}`);
  push(`Lazy-loaded: ${r.images.lazyLoadedCount} · optimization opportunity: ${r.images.optimizationOpportunityBytes > 0 ? `${r.images.optimizationOpportunityBytes} bytes` : "not measured"}`);
  push(`Schemas detected: ${r.schemaValidation.schemasDetected.join(", ") || "none"}`);
  push(`JSON-LD valid: ${r.schemaValidation.isValidJsonLd ? "yes" : "no"} · errors: ${r.schemaValidation.validationErrorsCount} · rich result eligible: ${r.schemaValidation.richSnippetEligible ? "yes" : "no"}`);

  heading("Search Console & keywords");
  if (r.searchConsole.isConnected) {
    push(`Property: ${r.searchConsole.siteUrl} · last ${r.searchConsole.periodDays} days`);
    push(`Clicks: ${r.searchConsole.totalClicks} · impressions: ${r.searchConsole.totalImpressions} · CTR: ${(r.searchConsole.averageCtr * 100).toFixed(2)}% · avg position: ${r.searchConsole.averagePosition.toFixed(1)}`);
    push(`Cannibalized queries: ${r.searchConsole.cannibalizationDetectedCount}`);
  } else {
    push("Not available — Google Search Console is not connected for this deployment.");
  }
  if (r.keywordsAndGaps.totalTargetKeywords > 0) {
    push(`Keywords tracked: ${r.keywordsAndGaps.totalTargetKeywords} · top 10: ${r.keywordsAndGaps.top10KeywordsCount} · top 3: ${r.keywordsAndGaps.top3KeywordsCount}`);
    push(`Content gaps: ${r.keywordsAndGaps.contentGapsIdentified}`);
  } else {
    push("Keyword volumes: not available — no keyword data provider is connected.");
  }

  heading("AI / GEO visibility");
  push(`GEO readiness score: ${r.aiGeoVisibility.visibilityScore}/100 (${r.aiGeoVisibility.dataAvailable ? "measured citations" : "on-page heuristic only"})`);
  push(r.aiGeoVisibility.methodology);
  if (r.aiGeoVisibility.dataAvailable) {
    const e = r.aiGeoVisibility.estimatedCitationsAcrossEngines;
    push(`Citations — Google AI Overviews: ${e.googleAiOverviews}, Perplexity: ${e.perplexity}, ChatGPT Search: ${e.chatgptSearch}, Claude: ${e.claude}`);
  }
  for (const rec of r.aiGeoVisibility.recommendations.slice(0, 6)) {
    push(`- ${rec}`);
  }

  heading("Prioritized action plan");
  const actions = [...r.actionPlan].sort((a, b) => a.priority.localeCompare(b.priority)).slice(0, 20);
  if (actions.length === 0) {
    push("No issues were raised by the rules engine.");
  } else {
    for (const item of actions) {
      push(`[${item.priority}] ${item.title}`, "bold", 10, 1);
      push(`${item.description} (impact: ${item.impact}; effort: ${item.effort})`, "regular", 9, 4);
    }
  }

  heading("Data provenance");
  push(`Measured: ${r.dataProvenance.measured.join("; ") || "none"}`);
  push(`Estimated: ${r.dataProvenance.estimated.join("; ") || "none"}`);
  push(`Unavailable: ${r.dataProvenance.unavailable.join("; ") || "none"}`);
  if (r.dataProvenance.simulated) {
    push("WARNING: simulated demo data was enabled for this report (ALLOW_SIMULATED_DATA=1).", "bold");
  }
  for (const note of r.dataProvenance.notes) {
    push(`Note: ${note}`);
  }

  lines.push({ text: "", size: 8, gapAfter: 0 });
  push("Generated by Cogwheel SEO Studio. Unavailable data sources are labelled, never estimated.", "regular", 8);

  return lines;
}

interface PagePlan {
  lines: Array<{ line: Line; y: number }>;
}

function paginate(lines: Line[]): PagePlan[] {
  const pages: PagePlan[] = [];
  let current: PagePlan = { lines: [] };
  let y = PAGE_HEIGHT - MARGIN;

  for (const line of lines) {
    const size = line.size ?? 10;
    const lineHeight = size * 1.35 + (line.gapAfter ?? 2);
    if (y - lineHeight < MARGIN) {
      pages.push(current);
      current = { lines: [] };
      y = PAGE_HEIGHT - MARGIN;
    }
    y -= lineHeight;
    current.lines.push({ line, y });
  }
  if (current.lines.length > 0) pages.push(current);
  return pages;
}

function contentStream(page: PagePlan): string {
  const parts: string[] = ["BT"];
  for (const { line, y } of page.lines) {
    const size = line.size ?? 10;
    const font = line.font === "bold" ? "/F2" : "/F1";
    parts.push(`${font} ${size} Tf`);
    parts.push(`1 0 0 1 ${MARGIN} ${y.toFixed(2)} Tm`);
    parts.push(`(${escapePdf(line.text)}) Tj`);
  }
  parts.push("ET");
  return parts.join("\n");
}

/** Builds a valid PDF byte buffer. */
export function buildAuditPdfReport(report: FullWebsiteAuditReport): Buffer {
  const pages = paginate(buildLines(report));

  // Object layout: 1 catalog, 2 pages tree, then (page, content) pairs, then fonts.
  const objects: string[] = [];
  const pageObjectNumbers: number[] = [];
  const fontRegular = 3 + pages.length * 2;
  const fontBold = fontRegular + 1;

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const kids = pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ");
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);

  pages.forEach((page, index) => {
    const pageNumber = 3 + index * 2;
    const contentNumber = pageNumber + 1;
    pageObjectNumbers.push(pageNumber);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> ` +
        `/Contents ${contentNumber} 0 R >>`,
    );
    const stream = contentStream(page);
    objects.push(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
  });

  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  const header = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const chunks: string[] = [header];
  const offsets: number[] = [];
  let position = Buffer.byteLength(header, "latin1");

  objects.forEach((body, index) => {
    offsets.push(position);
    const chunk = `${index + 1} 0 obj\n${body}\nendobj\n`;
    chunks.push(chunk);
    position += Buffer.byteLength(chunk, "latin1");
  });

  const xrefOffset = position;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  chunks.push(xref);
  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );

  return Buffer.from(chunks.join(""), "latin1");
}