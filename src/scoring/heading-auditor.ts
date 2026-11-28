/**
 * Heading Structure Optimization & Auditor Engine (TypeScript)
 *
 * Provides DOM-level structural heading auditing, SEO Studio hierarchy scoring,
 * non-semantic heading detection (UI stats, badges, quotes, footer columns),
 * single H1 enforcement, and coordinates execution with the Python generator.
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

export type HeadingLevel = "H1" | "H2" | "H3" | "H4" | "TEXT";

export type HeadingIssueType =
  | "missing_h1"
  | "multiple_h1"
  | "inverted_hierarchy"
  | "skipped_level"
  | "non_semantic_stat"
  | "non_semantic_badge"
  | "non_semantic_quote"
  | "non_semantic_footer"
  | "all_caps"
  | "none";

export interface RawHeadingNode {
  level: string;
  text: string;
  position?: number;
}

export interface AuditedHeadingItem {
  pageUrl: string;
  keyword: string;
  oldHeadline: string;
  oldHeadingLevel: string;
  newHeadline: string;
  newHeadingLevel: string;
  changeType: string;
  issue: HeadingIssueType;
  rationale: string;
}

export interface PageHeadingAuditSummary {
  url: string;
  path: string;
  category: string;
  keyword: string;
  h1CountBefore: number;
  h1CountAfter: number;
  totalHeadings: number;
  healthScore: number;
  issuesFound: HeadingIssueType[];
  headings: AuditedHeadingItem[];
}

export interface SiteHeadingOptimizedMap {
  domain: string;
  target_url: string;
  brand_name: string;
  primary_location: string;
  generated_at: string;
  total_pages_audited: number;
  total_headings_processed: number;
  excel_deliverable: string;
  pages: {
    url: string;
    path: string;
    category: string;
    keyword: string;
    h1_count_before: number;
    h1_count_after: number;
    total_headings: number;
    health_score: number;
    issues_found: string[];
    headings: {
      page_url: string;
      page_path: string;
      category: string;
      keyword: string;
      old_headline: string;
      old_level: string;
      new_headline: string;
      new_level: string;
      change_type: string;
      issue: string;
      rationale: string;
    }[];
  }[];
}

export interface HeadingAuditorOptions {
  url: string;
  keywordMapPath?: string;
  outputDir?: string;
  pythonPath?: string;
}

export interface HeadingAuditorRunResult {
  success: boolean;
  domain: string;
  excelPath?: string;
  jsonPath?: string;
  data?: SiteHeadingOptimizedMap;
  stdout?: string;
  stderr?: string;
  error?: string;
}

// Regex Detectors for Non-Semantic Headings
const RE_STAT_COUNTER =
  /^(?:[\d,]+[\+\%]?\s*(?:(?:sq\.?\s*ft\.?|square\s*feet)\s*)?(?:guest\s*rooms?|rooms?|suites?|sq\.?\s*ft\.?|square\s*feet|venues?|floors?|event\s*spaces?|stars?|capacity|acres?)|guest\s*rooms?|largest\s*venue|total\s*meeting\s*space|square\s*feet)$/i;

const RE_BED_VIEW_BADGE =
  /^(?:(?:1|2)\s*(?:king|queen|double|twin|full)\s*(?:beds?|size)?|(?:city|mountain|river|ocean|harbor|lake|courtyard|skyline|water)\s*views?|accessible|mobility\s*accessible|ada\s*compliant|non-smoking|pet[\s-]friendly)$/i;

const RE_TESTIMONIAL =
  /^["'“].*["'”]$|^(?:what\s*(?:our\s*)?guests?\s*say|guest\s*(?:reviews?|testimonials?)|traveler\s*ratings?|testimonials?|reviews?|verified\s*guest)$/i;

const RE_FOOTER_HEADER =
  /^(?:explore|reach\s*us|quick\s*links|stay\s*connected|navigation|site\s*map|follow\s*us|connect\s*with\s*us|newsletter|legal|privacy\s*(?:&|and)\s*cookies?|terms\s*(?:&|and)\s*conditions|social|careers|contact\s*(?:us|info|information)?)$/i;

/**
 * Normalizes string to standard Title Case.
 */
export function toTitleCase(text: string): string {
  const minorWords = new Set(["a", "an", "the", "and", "but", "or", "for", "nor", "on", "at", "to", "from", "by", "in", "of", "with"]);
  const words = text.trim().split(/\s+/);
  if (words.length === 0) return "";

  return words
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i > 0 && minorWords.has(lower)) {
        return lower;
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Detect non-semantic headings: stat counters, badges, testimonials, and footer headers.
 */
export function detectNonSemanticHeading(text: string): { isNonSemantic: boolean; issue: HeadingIssueType; rationale?: string } {
  const clean = text.trim();

  if (RE_STAT_COUNTER.test(clean) || /^\d{1,4}\+?\s*(?:rooms?|suites?|sq\.?\s*ft|feet|guests?)$/i.test(clean)) {
    return {
      isNonSemantic: true,
      issue: "non_semantic_stat",
      rationale: "UI stat counter or metric improperly tagged as heading; demote to TEXT.",
    };
  }

  if (RE_BED_VIEW_BADGE.test(clean)) {
    return {
      isNonSemantic: true,
      issue: "non_semantic_badge",
      rationale: "Decorative bed or view badge improperly tagged as heading; demote to TEXT.",
    };
  }

  if (RE_TESTIMONIAL.test(clean) || (clean.length > 50 && (clean.includes('"') || (clean.toLowerCase().includes("guest") && clean.toLowerCase().includes("review"))))) {
    return {
      isNonSemantic: true,
      issue: "non_semantic_quote",
      rationale: "Customer testimonial or review quote improperly tagged as heading; demote to TEXT.",
    };
  }

  if (RE_FOOTER_HEADER.test(clean)) {
    return {
      isNonSemantic: true,
      issue: "non_semantic_footer",
      rationale: "Footer or utility navigation header improperly tagged as heading; demote to TEXT.",
    };
  }

  return { isNonSemantic: false, issue: "none" };
}

/**
 * Perform pure in-memory structural audit and optimization for a list of headings on a page.
 */
export function auditHeadingOutline(
  headings: RawHeadingNode[],
  opts: {
    pageUrl?: string;
    primaryKeyword?: string;
    pageTitle?: string;
    brandName?: string;
    category?: string;
  } = {}
): PageHeadingAuditSummary {
  const pageUrl = opts.pageUrl || "https://example.com/";
  const primaryKeyword = opts.primaryKeyword || "Luxury Hotel";
  const brandName = opts.brandName || "Grand Hotel";
  const category = opts.category || "HOME";

  const issuesFound: HeadingIssueType[] = [];
  const auditedHeadings: AuditedHeadingItem[] = [];

  const h1Nodes = headings.filter((h) => h.level.toUpperCase() === "H1");
  const h1CountBefore = h1Nodes.length;

  if (h1CountBefore === 0) {
    issuesFound.push("missing_h1");
  } else if (h1CountBefore > 1) {
    issuesFound.push("multiple_h1");
  }

  // Inverted hierarchy: check if any H2 appears before the first H1
  const firstH1Index = headings.findIndex((h) => h.level.toUpperCase() === "H1");
  if (firstH1Index > 0) {
    const precedingH2s = headings.slice(0, firstH1Index).some((h) => h.level.toUpperCase() === "H2");
    if (precedingH2s) {
      issuesFound.push("inverted_hierarchy");
    }
  }

  // Canonical H1 formulation
  const cleanKeyword = toTitleCase(primaryKeyword);
  const cleanTopic = opts.pageTitle
    ? opts.pageTitle.split(" | ")[0].split(" - ")[0].trim()
    : "Overview";
  const canonicalH1 =
    cleanTopic.toLowerCase().includes(cleanKeyword.toLowerCase()) || cleanTopic === "Overview"
      ? cleanKeyword
      : `${cleanKeyword} | ${cleanTopic}`;

  let h1Assigned = false;

  // Insert synthetic H1 if none existed
  if (h1CountBefore === 0) {
    auditedHeadings.push({
      pageUrl,
      keyword: primaryKeyword,
      oldHeadline: "[MISSING H1]",
      oldHeadingLevel: "TEXT",
      newHeadline: canonicalH1,
      newHeadingLevel: "H1",
      changeType: "promote_to_h1",
      issue: "missing_h1",
      rationale: `Created missing H1 using primary keyword '${primaryKeyword}' and page topic.`,
    });
    h1Assigned = true;
  }

  let currentLevel = h1Assigned ? 1 : 0;

  for (let i = 0; i < headings.length; i++) {
    const raw = headings[i];
    const text = raw.text.trim();
    const lvl = raw.level.toUpperCase();
    const isAllCaps = text === text.toUpperCase() && text.length > 3 && /[A-Z]/.test(text);

    // 1. Check Non-Semantic Headings
    const nonSemantic = detectNonSemanticHeading(text);
    if (nonSemantic.isNonSemantic) {
      if (!issuesFound.includes(nonSemantic.issue)) {
        issuesFound.push(nonSemantic.issue);
      }
      auditedHeadings.push({
        pageUrl,
        keyword: primaryKeyword,
        oldHeadline: text,
        oldHeadingLevel: lvl,
        newHeadline: isAllCaps ? toTitleCase(text) : text,
        newHeadingLevel: "TEXT",
        changeType: "demote_to_text",
        issue: nonSemantic.issue,
        rationale: nonSemantic.rationale || "Demoted non-semantic heading to TEXT.",
      });
      continue;
    }

    // 2. Check H1
    if (lvl === "H1") {
      if (!h1Assigned) {
        auditedHeadings.push({
          pageUrl,
          keyword: primaryKeyword,
          oldHeadline: text,
          oldHeadingLevel: "H1",
          newHeadline: canonicalH1,
          newHeadingLevel: "H1",
          changeType: canonicalH1 !== text ? "rewrite_h1" : "no_change",
          issue: "none",
          rationale: "Optimized primary H1 with primary keyword focus and Title Case.",
        });
        h1Assigned = true;
        currentLevel = 1;
      } else {
        // Sibling H1 demotion
        if (!issuesFound.includes("multiple_h1")) {
          issuesFound.push("multiple_h1");
        }
        auditedHeadings.push({
          pageUrl,
          keyword: primaryKeyword,
          oldHeadline: text,
          oldHeadingLevel: "H1",
          newHeadline: toTitleCase(text),
          newHeadingLevel: "H2",
          changeType: "convert_h1_to_h2",
          issue: "multiple_h1",
          rationale: "Demoted duplicate H1 to H2 to ensure single H1 rule.",
        });
        currentLevel = 2;
      }
      continue;
    }

    // 3. Inverted H2 before H1
    if (!h1Assigned && lvl === "H2") {
      auditedHeadings.push({
        pageUrl,
        keyword: primaryKeyword,
        oldHeadline: text,
        oldHeadingLevel: "H2",
        newHeadline: toTitleCase(text),
        newHeadingLevel: "TEXT",
        changeType: "demote_to_text",
        issue: "inverted_hierarchy",
        rationale: "Demoted pre-H1 H2 to TEXT to resolve inverted hierarchy.",
      });
      continue;
    }

    // 4. H2 Handling
    if (lvl === "H2") {
      const optimizedH2 = toTitleCase(text);
      auditedHeadings.push({
        pageUrl,
        keyword: primaryKeyword,
        oldHeadline: text,
        oldHeadingLevel: "H2",
        newHeadline: optimizedH2,
        newHeadingLevel: "H2",
        changeType: isAllCaps ? "normalize_caps" : (optimizedH2 !== text ? "optimize_h2" : "no_change"),
        issue: isAllCaps ? "all_caps" : "none",
        rationale: "Enhanced section header as semantic H2.",
      });
      currentLevel = 2;
      continue;
    }

    // 5. H3 Handling & Skipped Level Check
    if (lvl === "H3") {
      const optimizedH3 = toTitleCase(text);
      if (currentLevel < 2) {
        if (!issuesFound.includes("skipped_level")) {
          issuesFound.push("skipped_level");
        }
        auditedHeadings.push({
          pageUrl,
          keyword: primaryKeyword,
          oldHeadline: text,
          oldHeadingLevel: "H3",
          newHeadline: optimizedH3,
          newHeadingLevel: "H2",
          changeType: "promote_to_h2",
          issue: "skipped_level",
          rationale: "Promoted skipped H3 to H2 to restore valid H1 -> H2 hierarchy.",
        });
        currentLevel = 2;
      } else {
        auditedHeadings.push({
          pageUrl,
          keyword: primaryKeyword,
          oldHeadline: text,
          oldHeadingLevel: "H3",
          newHeadline: optimizedH3,
          newHeadingLevel: "H3",
          changeType: isAllCaps ? "normalize_caps" : "no_change",
          issue: isAllCaps ? "all_caps" : "none",
          rationale: "Nested child card as semantic H3.",
        });
        currentLevel = 3;
      }
      continue;
    }

    // 6. Default Fallback
    auditedHeadings.push({
      pageUrl,
      keyword: primaryKeyword,
      oldHeadline: text,
      oldHeadingLevel: lvl,
      newHeadline: toTitleCase(text),
      newHeadingLevel: lvl,
      changeType: isAllCaps ? "normalize_caps" : "no_change",
      issue: isAllCaps ? "all_caps" : "none",
      rationale: "Retained existing heading level.",
    });
  }

  // Calculate Health Score
  let score = 100;
  if (issuesFound.includes("missing_h1")) score -= 30;
  if (issuesFound.includes("multiple_h1")) score -= 25;
  if (issuesFound.includes("inverted_hierarchy")) score -= 20;
  if (issuesFound.includes("skipped_level")) score -= 15;
  if (issuesFound.includes("non_semantic_stat")) score -= 10;
  if (issuesFound.includes("non_semantic_badge")) score -= 10;
  if (issuesFound.includes("non_semantic_quote")) score -= 10;
  if (issuesFound.includes("non_semantic_footer")) score -= 10;
  if (issuesFound.includes("all_caps")) score -= 5;

  const healthScore = Math.max(20, Math.min(100, score));

  return {
    url: pageUrl,
    path: "/",
    category,
    keyword: primaryKeyword,
    h1CountBefore,
    h1CountAfter: 1,
    totalHeadings: auditedHeadings.length,
    healthScore,
    issuesFound,
    headings: auditedHeadings,
  };
}

/**
 * Extract clean domain hostname from URL.
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

/**
 * Path helper for 03-heading-structure-optimization.xlsx.
 */
export function getHeadingExcelPath(urlOrDomain: string, baseDir: string = "output"): string {
  const domain = extractDomain(urlOrDomain);
  return path.resolve(process.cwd(), baseDir, domain, "03-heading-structure-optimization.xlsx");
}

/**
 * Path helper for site-heading-optimized.json.
 */
export function getHeadingOptimizedJsonPath(urlOrDomain: string, baseDir: string = "output"): string {
  const domain = extractDomain(urlOrDomain);
  return path.resolve(process.cwd(), baseDir, domain, "site-heading-optimized.json");
}

/**
 * Load the downstream site-heading-optimized.json directly into TypeScript.
 */
export function loadSiteHeadingOptimized(
  urlOrDomain: string,
  baseDir: string = "output"
): SiteHeadingOptimizedMap | null {
  const filePath = getHeadingOptimizedJsonPath(urlOrDomain, baseDir);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as SiteHeadingOptimizedMap;
}

/**
 * Execute Python heading_optimizer engine via child_process.
 */
export async function runHeadingOptimizer(
  options: HeadingAuditorOptions
): Promise<HeadingAuditorRunResult> {
  const domain = extractDomain(options.url);
  const baseDir = options.outputDir || "output";
  const pythonBin =
    options.pythonPath ||
    (fs.existsSync(path.resolve(process.cwd(), ".venv/bin/python3"))
      ? path.resolve(process.cwd(), ".venv/bin/python3")
      : "python3");

  const args = ["-m", "python.generators.heading_optimizer", "--url", options.url];

  if (options.keywordMapPath) {
    args.push("--keyword-map", options.keywordMapPath);
  }
  if (options.outputDir) {
    args.push("--output-dir", options.outputDir);
  }

  return new Promise((resolve) => {
    const env = {
      ...process.env,
      PYTHONPATH: process.cwd(),
    };

    const proc = spawn(pythonBin, args, { cwd: process.cwd(), env });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    proc.on("close", (code) => {
      const excelPath = getHeadingExcelPath(options.url, baseDir);
      const jsonPath = getHeadingOptimizedJsonPath(options.url, baseDir);

      if (code === 0 && fs.existsSync(jsonPath)) {
        try {
          const raw = fs.readFileSync(jsonPath, "utf-8");
          const data = JSON.parse(raw) as SiteHeadingOptimizedMap;
          resolve({
            success: true,
            domain,
            excelPath: fs.existsSync(excelPath) ? excelPath : undefined,
            jsonPath,
            data,
            stdout,
            stderr,
          });
        } catch (parseErr: unknown) {
          const errMessage = parseErr instanceof Error ? parseErr.message : String(parseErr);
          resolve({
            success: false,
            domain,
            error: `Failed to parse output JSON: ${errMessage}`,
            stdout,
            stderr,
          });
        }
      } else {
        resolve({
          success: false,
          domain,
          error: `Process exited with code ${code}. Stderr: ${stderr.slice(-500)}`,
          stdout,
          stderr,
        });
      }
    });

    proc.on("error", (err) => {
      resolve({
        success: false,
        domain,
        error: `Failed to spawn python process: ${err.message}`,
        stdout,
        stderr,
      });
    });
  });
}
