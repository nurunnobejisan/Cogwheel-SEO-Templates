/**
 * Automated Keyword Research & Page-Mapping Engine (TypeScript Bridge)
 *
 * Programmatically coordinates site discovery, keyword clustering,
 * de-cannibalized page assignment, and report generation via the Python engine.
 * Reads and serves /output/<domain>/site-keyword-map.json to Commands 2, 3, and 4.
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

export type PageArchetype =
  | "home"
  | "category_overview"
  | "product_or_room"
  | "service_or_amenity"
  | "dining_or_outlet"
  | "events_or_offers"
  | "about_or_history"
  | "faq"
  | "gallery"
  | "blog";

export interface DiscoveredPage {
  url: string;
  path: string;
  title: string;
  archetype: PageArchetype;
  h1: string;
  h2_list: string[];
  meta_description: string;
  topics: string[];
  word_count: number;
  internal_links_count: number;
  external_links_count: number;
  status_code: number;
}

export interface PageAssignment {
  page_id: string;
  url: string;
  path: string;
  title: string;
  archetype: PageArchetype;
  primary_keyword: string;
  volume: number;
  kd: number;
  current_position?: number | null;
  intent: string;
  rationale: string;
}

export interface KeywordBucketItem {
  keyword: string;
  volume: number;
  kd: number;
  current_position?: number | null;
  intent: string;
  is_opportunity: boolean;
  assigned_page_path?: string | null;
  bucket_name?: string | null;
}

export interface KeywordBucket {
  bucket_name: string;
  total_volume: number;
  keywords: KeywordBucketItem[];
}

export interface SiteKeywordMapSummary {
  total_monthly_search_volume: number;
  total_opportunity_keywords: number;
  high_opportunity_threshold_kd: number;
}

export interface SiteKeywordMap {
  domain: string;
  target_url: string;
  brand_name: string;
  primary_location: string;
  core_offerings: string[];
  generated_at: string;
  total_pages_mapped: number;
  pages: PageAssignment[];
  keyword_buckets: KeywordBucket[];
  summary: SiteKeywordMapSummary;
  report_file: string;
}

export interface KeywordResearchRunOptions {
  url: string;
  csvPath?: string;
  maxPages?: number;
  outputDir?: string;
  pythonPath?: string;
}

export interface KeywordResearchResult {
  success: boolean;
  domain: string;
  targetUrl: string;
  brandName: string;
  primaryLocation: string;
  totalPages: number;
  docxReportPath: string;
  jsonMapPath: string;
  mapData?: SiteKeywordMap;
  error?: string;
}

/**
 * Resolves the preferred Python executable (.venv preferred over system python3).
 */
export function getPythonBinary(customPath?: string): string {
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }
  const venvPython = path.resolve(process.cwd(), ".venv", "bin", "python3");
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }
  return "python3";
}

/**
 * Normalizes domain from arbitrary URL string.
 */
export function extractDomainFromUrl(inputUrl: string): string {
  try {
    const raw = inputUrl.startsWith("http://") || inputUrl.startsWith("https://")
      ? inputUrl
      : `https://${inputUrl}`;
    const parsed = new URL(raw);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return inputUrl.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
  }
}

/**
 * Loads previously generated site-keyword-map.json for a domain.
 * Consumed by Commands 2, 3, and 4 (Title & Meta, Content Briefs, Schema).
 */
export async function loadSiteKeywordMap(
  domainOrUrl: string,
  outputBaseDir: string = "output"
): Promise<SiteKeywordMap | null> {
  const domain = extractDomainFromUrl(domainOrUrl);
  const jsonPath = path.resolve(process.cwd(), outputBaseDir, domain, "site-keyword-map.json");

  if (!fs.existsSync(jsonPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(jsonPath, "utf-8");
    return JSON.parse(content) as SiteKeywordMap;
  } catch (err) {
    console.error(`[KeywordResearch] Error parsing ${jsonPath}:`, err);
    return null;
  }
}

/**
 * Executes the Python Keyword Research & Page-Mapping engine.
 */
export async function runKeywordResearch(
  options: KeywordResearchRunOptions
): Promise<KeywordResearchResult> {
  const pythonBin = getPythonBinary(options.pythonPath);
  const domain = extractDomainFromUrl(options.url);
  const maxPages = options.maxPages || 35;
  const outputDir = options.outputDir || "output";

  const args = [
    "-m",
    "python.generators.keyword_research",
    "--url",
    options.url,
    "--max-pages",
    String(maxPages),
    "--output-dir",
    outputDir,
  ];

  if (options.csvPath) {
    args.push("--csv", options.csvPath);
  }

  return new Promise((resolve) => {
    const child = spawn(pythonBin, args, {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONPATH: process.cwd() },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", async (code) => {
      if (code !== 0) {
        resolve({
          success: false,
          domain,
          targetUrl: options.url,
          brandName: "",
          primaryLocation: "",
          totalPages: 0,
          docxReportPath: "",
          jsonMapPath: "",
          error: stderr || `Process exited with code ${code}`,
        });
        return;
      }

      const mapData = await loadSiteKeywordMap(domain, outputDir);
      if (!mapData) {
        resolve({
          success: false,
          domain,
          targetUrl: options.url,
          brandName: "",
          primaryLocation: "",
          totalPages: 0,
          docxReportPath: "",
          jsonMapPath: "",
          error: "site-keyword-map.json was not generated.",
        });
        return;
      }

      resolve({
        success: true,
        domain,
        targetUrl: mapData.target_url,
        brandName: mapData.brand_name,
        primaryLocation: mapData.primary_location,
        totalPages: mapData.total_pages_mapped,
        docxReportPath: mapData.report_file,
        jsonMapPath: path.resolve(process.cwd(), outputDir, domain, "site-keyword-map.json"),
        mapData,
      });
    });

    child.on("error", (err) => {
      resolve({
        success: false,
        domain,
        targetUrl: options.url,
        brandName: "",
        primaryLocation: "",
        totalPages: 0,
        docxReportPath: "",
        jsonMapPath: "",
        error: `Failed to spawn python process: ${err.message}`,
      });
    });
  });
}
