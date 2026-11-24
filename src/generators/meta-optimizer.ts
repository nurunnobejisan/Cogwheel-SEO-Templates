/**
 * Automated Title & Meta Description Generator (TypeScript Bridge)
 *
 * Programmatically coordinates SEO Title and Meta Description optimization,
 * enforcing Cogwheel's strict length constraints (<= 60 title, 145-160 meta),
 * first-half keyword positioning, verified page USPs, and action CTAs.
 * Reads /output/<domain>/site-keyword-map.json and writes:
 * - /output/<domain>/02-meta-title-description.xlsx (OpenPyXL styled workbook)
 * - /output/<domain>/site-meta-optimized.json (for downstream Commands 3 & 4)
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

export interface OptimizedMetaPage {
  page_id: string;
  url: string;
  path: string;
  page_name: string;
  archetype: string;
  keyword_focus: string;
  old_title: string;
  new_title: string;
  title_length: number;
  old_meta_description: string;
  new_meta_description: string;
  meta_length: number;
  usps_used: string[];
  cta_used: string;
  title_formula?: string;
  meta_formula?: string;
}

export interface SiteMetaOptimizedMap {
  domain: string;
  target_url: string;
  brand_name: string;
  primary_location: string;
  generated_at: string;
  total_pages_optimized: number;
  excel_deliverable: string;
  pages: OptimizedMetaPage[];
}

export interface MetaOptimizerRunOptions {
  url: string;
  keywordMapPath?: string;
  outputDir?: string;
  pythonPath?: string;
}

export interface MetaOptimizerResult {
  success: boolean;
  domain: string;
  excelPath?: string;
  jsonPath?: string;
  data?: SiteMetaOptimizedMap;
  stdout?: string;
  stderr?: string;
  error?: string;
}

/**
 * Extract clean domain hostname from a URL.
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
 * Resolve the default output path for site-meta-optimized.json.
 */
export function getMetaOptimizedJsonPath(urlOrDomain: string, baseDir: string = "output"): string {
  const domain = extractDomain(urlOrDomain);
  return path.resolve(process.cwd(), baseDir, domain, "site-meta-optimized.json");
}

/**
 * Resolve the default deliverable Excel path.
 */
export function getMetaExcelPath(urlOrDomain: string, baseDir: string = "output"): string {
  const domain = extractDomain(urlOrDomain);
  return path.resolve(process.cwd(), baseDir, domain, "02-meta-title-description.xlsx");
}

/**
 * Load the downstream site-meta-optimized.json directly into TypeScript objects.
 */
export function loadSiteMetaOptimized(
  urlOrDomain: string,
  baseDir: string = "output"
): SiteMetaOptimizedMap | null {
  const filePath = getMetaOptimizedJsonPath(urlOrDomain, baseDir);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as SiteMetaOptimizedMap;
}

/**
 * Execute the Python meta_optimizer engine via child_process.
 */
export async function runMetaOptimizer(
  options: MetaOptimizerRunOptions
): Promise<MetaOptimizerResult> {
  const domain = extractDomain(options.url);
  const baseDir = options.outputDir || "output";
  const pythonBin =
    options.pythonPath ||
    (fs.existsSync(path.resolve(process.cwd(), ".venv/bin/python3"))
      ? path.resolve(process.cwd(), ".venv/bin/python3")
      : "python3");

  const args = [
    "-m",
    "python.generators.meta_optimizer",
    "--url",
    options.url,
  ];

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
      const excelPath = getMetaExcelPath(options.url, baseDir);
      const jsonPath = getMetaOptimizedJsonPath(options.url, baseDir);

      if (code === 0 && fs.existsSync(jsonPath)) {
        try {
          const raw = fs.readFileSync(jsonPath, "utf-8");
          const data = JSON.parse(raw) as SiteMetaOptimizedMap;
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
