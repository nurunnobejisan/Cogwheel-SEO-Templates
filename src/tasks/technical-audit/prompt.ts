import type { CrawlPageRecord, CrawlRunRecord } from "@/core/crawler";
import type { Property } from "@/lib/types";
import {
  technicalAuditRowSchema,
  type TechnicalAuditRowDraft,
  type TechnicalAuditSummary,
  type TechnicalFinding,
} from "./schema";

export function detectDeterministicTechnicalFindings(
  crawlRun: CrawlRunRecord,
  pages: CrawlPageRecord[],
): { findings: TechnicalFinding[]; summary: TechnicalAuditSummary } {
  const findings: TechnicalFinding[] = [];
  const orphanSet = new Set(crawlRun.siteSummary.orphanPages);

  let brokenCount = 0;
  let redirectCount = 0;
  let jsRenderedCount = 0;
  let missingCanonicalCount = 0;
  let noindexCount = 0;
  let missingFromSitemapCount = 0;
  let slowPagesCount = 0;

  for (const page of pages) {
    if (page.statusCode >= 400 || page.statusCode === 0) {
      brokenCount++;
      findings.push({
        url: page.url,
        category: "broken-link",
        severity: page.statusCode >= 500 || page.statusCode === 0 ? "critical" : "high",
        detail: `HTTP status ${page.statusCode}`,
      });
    }

    if (page.redirectChain.length > 0) {
      redirectCount++;
      findings.push({
        url: page.url,
        category: "redirect-chain",
        severity: page.redirectChain.length > 1 ? "high" : "medium",
        detail: `${page.redirectChain.length} redirect hop(s) -> ${page.finalUrl}`,
      });
    }

    if (orphanSet.has(page.url)) {
      findings.push({
        url: page.url,
        category: "orphan-page",
        severity: "medium",
        detail: "In sitemap or crawled, but 0 internal links point to this URL",
      });
    }

    if (page.needsJsRendering) {
      jsRenderedCount++;
      findings.push({
        url: page.url,
        category: "js-rendering",
        severity: "high",
        detail: "Empty or minimal SSR body; requires JS rendering for primary content",
      });
    }

    if (page.statusCode === 200 && !page.canonical) {
      missingCanonicalCount++;
      findings.push({
        url: page.url,
        category: "canonical",
        severity: "medium",
        detail: "Missing <link rel='canonical'> tag",
      });
    } else if (page.statusCode === 200 && page.canonical && page.canonical !== page.finalUrl) {
      findings.push({
        url: page.url,
        category: "canonical",
        severity: "medium",
        detail: `Canonical points to ${page.canonical} instead of ${page.finalUrl}`,
      });
    }

    if ((page.robotsMeta ?? "").toLowerCase().includes("noindex")) {
      noindexCount++;
      findings.push({
        url: page.url,
        category: "indexability",
        severity: page.depth === 0 ? "critical" : "high",
        detail: `Robots meta directive: ${page.robotsMeta}`,
      });
    }

    if (page.statusCode === 200 && !page.inSitemap) {
      missingFromSitemapCount++;
      findings.push({
        url: page.url,
        category: "sitemap",
        severity: "low",
        detail: "Indexable 200 URL missing from XML sitemap",
      });
    }

    if (page.responseTimeMs > 1500) {
      slowPagesCount++;
      findings.push({
        url: page.url,
        category: "performance",
        severity: page.responseTimeMs > 3000 ? "high" : "medium",
        detail: `Slow TTFB / response time: ${page.responseTimeMs}ms`,
      });
    }
  }

  if (!crawlRun.siteSummary.robotsTxtPresent) {
    findings.push({
      url: "site-wide",
      category: "indexability",
      severity: "medium",
      detail: "No robots.txt detected at origin",
    });
  }

  return {
    findings,
    summary: {
      totalPages: pages.length,
      brokenCount,
      redirectCount,
      orphanCount: orphanSet.size,
      jsRenderedCount,
      missingCanonicalCount,
      noindexCount,
      missingFromSitemapCount,
      slowPagesCount,
    },
  };
}

export function buildTechnicalAuditPrompt(opts: {
  property: Pick<Property, "name" | "brand" | "city" | "state" | "url" | "notes">;
  findings: TechnicalFinding[];
  summary: TechnicalAuditSummary;
  feedback?: string[];
}): { system: string; prompt: string } {
  const system = `You are a Principal Hospitality Technical SEO Engineer.
Convert deterministic crawl findings into an actionable, prioritized Technical SEO Remediation Plan.

STRICT GROUNDING RULES:
- ONLY reference URLs and metrics present in the deterministic findings provided below.
- Do NOT invent URLs, status codes, Core Web Vitals scores, or server details not present in the input.
- Output ONLY a valid JSON array matching the requested schema.`;

  const feedbackBlock =
    opts.feedback && opts.feedback.length > 0
      ? `\n\nPREVIOUS VALIDATION FEEDBACK (FIX ALL):\n${opts.feedback.map((f) => `- ${f}`).join("\n")}`
      : "";

  const prompt = `PROPERTY:
- Name: ${opts.property.name} (${opts.property.brand})
- Location: ${opts.property.city}, ${opts.property.state}
- URL: ${opts.property.url ?? "N/A"}

CRAWL SUMMARY:
${JSON.stringify(opts.summary, null, 2)}

DETERMINISTIC FINDINGS (${opts.findings.length}):
${JSON.stringify(opts.findings.slice(0, 80), null, 2)}
${feedbackBlock}

Return ONLY a JSON array of objects with keys:
- "url": string (exact URL from findings, or "site-wide")
- "category": "broken-link" | "redirect-chain" | "orphan-page" | "js-rendering" | "canonical" | "indexability" | "sitemap" | "performance"
- "severity": "critical" | "high" | "medium" | "low"
- "issue": string (concise factual description of the detected problem)
- "recommendation": string (concrete engineering/SEO fix)
- "owner": "Dev" | "SEO" | "Content"
- "impact": string (expected SEO / crawlability / direct-booking impact)`;

  return { system, prompt };
}

export function parseTechnicalAuditDraft(rawText: string): TechnicalAuditRowDraft[] {
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Claude response did not contain a JSON array.");
  }

  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown[];
  return parsed.map((row) => technicalAuditRowSchema.parse(row));
}

