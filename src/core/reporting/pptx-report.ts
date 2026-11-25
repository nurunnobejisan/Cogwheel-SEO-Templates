/**
 * PowerPoint (.pptx) audit report.
 *
 * Client-ready deck generated from the same audit payload as the HTML/PDF
 * reports. Unavailable data sources are labelled explicitly; no slide invents a
 * number for a dimension that was not measured.
 */

import PptxGenJS from "pptxgenjs";
import type { FullWebsiteAuditReport } from "../full-audit/types.ts";

const INK = "0F172A";
const MUTED = "64748B";
const LINE = "E2E8F0";
const PANEL = "F1F5F9";
const GOOD = "166534";
const WARN = "92400E";
const BAD = "991B1B";
const ACCENT = "1D4ED8";

const PAGE_W = 10;
const PAGE_H = 5.625;
const MARGIN = 0.45;
const CONTENT_W = PAGE_W - MARGIN * 2;

type Cell = string | number;

function toTableRows(rows: Cell[][]): PptxGenJS.TableRow[] {
  return rows.map((row) => row.map((cell) => ({ text: String(cell) })));
}

function truncate(value: string, max: number): string {
  const text = String(value ?? "").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function scoreColor(score: number): string {
  if (score >= 80) return GOOD;
  if (score >= 60) return WARN;
  return BAD;
}

function scoreTable(report: FullWebsiteAuditReport): Cell[][] {
  return [
    ["Dimension", "Score"],
    ["Technical health", report.scores.technical],
    ["On-page SEO", report.scores.onPage],
    ["Heading structure", report.scores.headings],
    ["Images", report.scores.images],
    ["Structured data", report.scores.schema],
    ["Search Console", report.searchConsole.isConnected ? report.scores.gsc : "Not connected"],
    ["AI / GEO readiness", report.scores.aiVisibility],
  ];
}

function technicalRows(r: FullWebsiteAuditReport): Cell[][] {
  return [
    ["HTTP status", r.technicalHealth.statusCode],
    ["Response time", `${r.technicalHealth.responseTimeMs} ms`],
    ["HTTPS", r.technicalHealth.isHttps ? "Yes" : "No"],
    ["Compression", r.technicalHealth.hasCompression ? "Enabled" : "Disabled"],
    ["Server", r.technicalHealth.server || "Not disclosed"],
    ["Indexable", r.crawlability.isIndexable ? "Yes" : "No"],
    ["noindex / nofollow", `${r.crawlability.hasNoindex ? "yes" : "no"} / ${r.crawlability.hasNofollow ? "yes" : "no"}`],
    ["robots.txt", r.crawlability.hasRobotsTxt ? r.crawlability.robotsTxtUrl : "Not found"],
    ["Sitemaps", r.crawlability.discoveredSitemaps.length > 0 ? String(r.crawlability.discoveredSitemaps.length) : "None discovered"],
    ["Internal / external links", `${r.crawlability.totalInternalLinksDiscovered} / ${r.crawlability.totalExternalLinksDiscovered}`],
  ];
}

function onPageRows(r: FullWebsiteAuditReport): Cell[][] {
  return [
    ["Title", truncate(r.onPage.title || "(missing)", 110)],
    ["Title length", `${r.onPage.titleLength} chars / ${r.onPage.titlePixelWidth}px (${r.onPage.isTitleBudgetCompliant ? "within" : "outside"} budget)`],
    ["Meta description", truncate(r.onPage.metaDescription || "(missing)", 110)],
    ["Meta length", `${r.onPage.metaDescriptionLength} chars (${r.onPage.isMetaBudgetCompliant ? "within" : "outside"} budget)`],
    ["Words / reading time", `${r.onPage.wordCount} / ${r.onPage.readingTimeMinutes} min`],
    ["Headings", `${r.headings.totalHeadings} total · H1 ${r.headings.h1Count} · H2 ${r.headings.h2Count} · H3 ${r.headings.h3Count}`],
    ["Heading hierarchy", r.headings.hierarchyValid ? "Valid" : `${r.headings.issuesCount} issue(s)`],
    ["Images", `${r.images.totalImages} total · ${r.images.missingAltCount} missing alt · ${r.images.oversizedCount} oversized`],
    ["Schema detected", truncate(r.schemaValidation.schemasDetected.join(", ") || "none", 110)],
  ];
}

function searchRows(r: FullWebsiteAuditReport): Cell[][] {
  const rows: Cell[][] = [];
  if (r.searchConsole.isConnected) {
    rows.push(
      ["Search Console", `Connected · ${r.searchConsole.periodDays} days`],
      ["Clicks / impressions", `${r.searchConsole.totalClicks} / ${r.searchConsole.totalImpressions}`],
      ["CTR / avg position", `${(r.searchConsole.averageCtr * 100).toFixed(2)}% / ${r.searchConsole.averagePosition.toFixed(1)}`],
      ["Cannibalized queries", r.searchConsole.cannibalizationDetectedCount],
    );
  } else {
    rows.push(["Search Console", "Not available — credentials not connected"]);
  }

  if (r.keywordsAndGaps.totalTargetKeywords > 0) {
    rows.push(
      ["Keywords tracked", r.keywordsAndGaps.totalTargetKeywords],
      ["Top 3 / top 10", `${r.keywordsAndGaps.top3KeywordsCount} / ${r.keywordsAndGaps.top10KeywordsCount}`],
      ["Content gaps", r.keywordsAndGaps.contentGapsIdentified],
    );
    for (const kw of r.keywordsAndGaps.topOpportunities.slice(0, 4)) {
      rows.push([`Opportunity: ${truncate(kw.keyword, 46)}`, `${kw.searchVolume} vol · ${kw.difficulty} KD`]);
    }
  } else {
    rows.push(["Keyword volumes", "Not available — no keyword data provider connected"]);
  }
  return rows;
}

function geoCells(r: FullWebsiteAuditReport): Cell[][] {
  const geo = r.aiGeoVisibility;
  const rows: Cell[][] = [
    ["GEO readiness score", `${geo.visibilityScore}/100`],
    ["Brand entity clarity", `${geo.brandEntityClarity}/100`],
    ["Fact density", `${geo.factDensityScore}/100`],
    ["Citations queried", geo.dataAvailable ? "Yes" : "No — on-page heuristic only"],
    ["Methodology", truncate(geo.methodology, 130)],
  ];
  if (geo.dataAvailable) {
    const e = geo.estimatedCitationsAcrossEngines;
    rows.push([
      "Citations",
      `Google AIO ${e.googleAiOverviews} · Perplexity ${e.perplexity} · ChatGPT ${e.chatgptSearch} · Claude ${e.claude}`,
    ]);
  }
  for (const rec of geo.recommendations.slice(0, 3)) {
    rows.push(["Recommendation", truncate(rec, 130)]);
  }
  return rows;
}

export async function buildAuditPptxReport(report: FullWebsiteAuditReport): Promise<Buffer> {
  const r = report;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "Cogwheel SEO Studio";
  pptx.company = "Cogwheel";
  pptx.subject = `SEO & GEO audit for ${r.domain}`;
  pptx.title = `SEO & GEO Audit — ${r.domain}`;

  const addHeader = (slide: PptxGenJS.Slide, title: string, subtitle?: string) => {
    slide.addText(title, {
      x: MARGIN,
      y: 0.3,
      w: CONTENT_W,
      h: 0.45,
      fontSize: 22,
      bold: true,
      color: INK,
    });
    if (subtitle) {
      slide.addText(subtitle, {
        x: MARGIN,
        y: 0.72,
        w: CONTENT_W,
        h: 0.28,
        fontSize: 10,
        color: MUTED,
      });
    }
    slide.addShape(pptx.ShapeType.rect, {
      x: MARGIN,
      y: 1.02,
      w: CONTENT_W,
      h: 0.02,
      fill: { color: LINE },
    });
  };

  const addFooter = (slide: PptxGenJS.Slide, page: number) => {
    slide.addText(`Cogwheel SEO Studio · ${r.domain} · ${new Date(r.createdAt).toISOString().slice(0, 10)}`, {
      x: MARGIN,
      y: PAGE_H - 0.34,
      w: CONTENT_W - 0.6,
      h: 0.22,
      fontSize: 8,
      color: MUTED,
    });
    slide.addText(String(page), {
      x: PAGE_W - MARGIN - 0.4,
      y: PAGE_H - 0.34,
      w: 0.4,
      h: 0.22,
      fontSize: 8,
      color: MUTED,
      align: "right",
    });
  };

  const addTableSlide = (title: string, subtitle: string, rows: Cell[][], page: number) => {
    const slide = pptx.addSlide();
    addHeader(slide, title, subtitle);
    slide.addTable(toTableRows(rows), {
      x: MARGIN,
      y: 1.2,
      w: CONTENT_W,
      colW: [2.35, CONTENT_W - 2.35],
      fontSize: 10,
      color: INK,
      border: { type: "solid", color: LINE, pt: 0.5 },
      fill: { color: "FFFFFF" },
      rowH: 0.28,
      valign: "middle",
      margin: 0.06,
    });
    addFooter(slide, page);
    return slide;
  };

  // 1 — Cover
  const cover = pptx.addSlide();
  cover.background = { color: PANEL };
  cover.addText("SEO & GEO AUDIT", {
    x: MARGIN,
    y: 0.9,
    w: CONTENT_W,
    h: 0.35,
    fontSize: 12,
    bold: true,
    color: ACCENT,
    charSpacing: 3,
  });
  cover.addText(r.domain, {
    x: MARGIN,
    y: 1.3,
    w: CONTENT_W,
    h: 1.0,
    fontSize: 40,
    bold: true,
    color: INK,
  });
  cover.addText(r.targetUrl, {
    x: MARGIN,
    y: 2.28,
    w: CONTENT_W,
    h: 0.35,
    fontSize: 12,
    color: MUTED,
  });
  cover.addShape(pptx.ShapeType.roundRect, {
    x: MARGIN,
    y: 2.95,
    w: 2.6,
    h: 1.35,
    rectRadius: 0.12,
    fill: { color: "FFFFFF" },
    line: { color: LINE, width: 1 },
  });
  cover.addText(String(r.overallScore), {
    x: MARGIN + 0.2,
    y: 3.08,
    w: 1.2,
    h: 0.75,
    fontSize: 44,
    bold: true,
    color: scoreColor(r.overallScore),
  });
  cover.addText("/ 100 overall", {
    x: MARGIN + 1.25,
    y: 3.34,
    w: 1.25,
    h: 0.3,
    fontSize: 11,
    color: MUTED,
  });
  cover.addText(`Generated ${new Date(r.createdAt).toUTCString()}\nReport ${r.id} · ${r.durationMs} ms`, {
    x: 3.5,
    y: 3.1,
    w: CONTENT_W - 3.05,
    h: 0.9,
    fontSize: 11,
    color: MUTED,
    lineSpacingMultiple: 1.3,
  });
  cover.addText(
    r.dataProvenance.simulated
      ? "WARNING: this deck includes simulated demo data (ALLOW_SIMULATED_DATA=1)."
      : "All figures are measured from the live site or explicitly labelled as unavailable.",
    {
      x: MARGIN,
      y: 4.85,
      w: CONTENT_W,
      h: 0.3,
      fontSize: 9,
      italic: true,
      color: r.dataProvenance.simulated ? BAD : MUTED,
    },
  );

  // 2 — Score summary
  addTableSlide(
    "Executive scorecard",
    "Scores are computed from the live page and the bundled rules engine.",
    scoreTable(r),
    2,
  );

  // 3 — Technical + crawlability
  addTableSlide("Technical health & crawlability", "Measured from the live HTTP response and HTML.", technicalRows(r), 3);

  // 4 — On-page
  addTableSlide("On-page SEO, headings & images", "Measured from the rendered document.", onPageRows(r), 4);

  // 5 — Search Console / keywords
  addTableSlide("Search Console & keyword intelligence", "Only shown when a data source is connected.", searchRows(r), 5);

  // 6 — GEO
  addTableSlide("AI visibility / GEO readiness", "On-page heuristic unless AI citations were queried.", geoCells(r), 6);

  // 7+ — Action plan, 6 per slide
  const actions = [...r.actionPlan].sort((a, b) => a.priority.localeCompare(b.priority));
  if (actions.length === 0) {
    const slide = pptx.addSlide();
    addHeader(slide, "Prioritized action plan", "Rules engine output");
    slide.addText("No issues were raised by the rules engine.", {
      x: MARGIN,
      y: 1.4,
      w: CONTENT_W,
      h: 0.4,
      fontSize: 12,
      color: MUTED,
    });
    addFooter(slide, 7);
  } else {
    const perSlide = 6;
    for (let i = 0; i < actions.length; i += perSlide) {
      const chunk = actions.slice(i, i + perSlide);
      const slide = pptx.addSlide();
      addHeader(
        slide,
        "Prioritized action plan",
        `P0 first · ${i + 1}–${i + chunk.length} of ${actions.length}`,
      );
      const rows: Cell[][] = [["Priority", "Action", "Impact", "Effort"]];
      for (const item of chunk) {
        rows.push([
          item.priority,
          truncate(`${item.title} — ${item.description}`, 150),
          item.impact,
          item.effort,
        ]);
      }
      slide.addTable(toTableRows(rows), {
        x: MARGIN,
        y: 1.2,
        w: CONTENT_W,
        colW: [0.7, 6.0, 1.5, 0.85],
        fontSize: 8.5,
        color: INK,
        border: { type: "solid", color: LINE, pt: 0.5 },
        fill: { color: "FFFFFF" },
        valign: "top",
        margin: 0.05,
        autoPage: false,
      });
      addFooter(slide, 7 + Math.floor(i / perSlide));
    }
  }

  // Last — Provenance
  const prov = pptx.addSlide();
  addHeader(prov, "Data provenance", "What was measured, estimated and unavailable");
  const provRows: Cell[][] = [
    ["Measured", r.dataProvenance.measured.join("; ") || "None"],
    ["Estimated", r.dataProvenance.estimated.join("; ") || "None"],
    ["Unavailable", r.dataProvenance.unavailable.join("; ") || "None"],
  ];
  prov.addTable(toTableRows(provRows), {
    x: MARGIN,
    y: 1.2,
    w: CONTENT_W,
    colW: [1.3, CONTENT_W - 1.3],
    fontSize: 9,
    color: INK,
    border: { type: "solid", color: LINE, pt: 0.5 },
    fill: { color: "FFFFFF" },
    valign: "top",
    margin: 0.08,
  });
  if (r.dataProvenance.notes.length > 0) {
    prov.addText(r.dataProvenance.notes.map((note) => `• ${note}`).join("\n"), {
      x: MARGIN,
      y: 3.35,
      w: CONTENT_W,
      h: 1.3,
      fontSize: 8.5,
      color: MUTED,
      lineSpacingMultiple: 1.25,
    });
  }
  addFooter(prov, 7 + Math.ceil(actions.length / 6) + (actions.length === 0 ? 1 : 0));

  const data = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.from(data as Uint8Array);
}
