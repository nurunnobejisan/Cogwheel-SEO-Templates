/**
 * Automated Image SEO & Accessibility Optimization (TypeScript Bridge)
 *
 * Coordinates site-wide image auditing, deduplication, raw filename cleanup,
 * and context-grounded ALT text generation (50-85 chars, hard cap <= 125 chars).
 * Serves /output/<domain>/04-image-optimization.xlsx and /output/<domain>/site-images-optimized.json.
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

export interface ImageAssetItem {
  image_url: string;
  canonical_filename: string;
  file_format: string;
  title: string;
  title_length: number;
  old_alt: string;
  old_alt_length: number;
  optimized_alt: string;
  optimized_alt_length: number;
  page_urls: string[];
  surrounding_headings: string[];
  is_raw_filename: boolean;
  is_missing_alt: boolean;
  is_overlong_alt: boolean;
  is_duplicate_alt: boolean;
  dimensions: string;
  primary_subject: string;
}

export interface SiteImagesOptimizedMap {
  domain: string;
  target_url: string;
  brand_name: string;
  primary_location: string;
  generated_at: string;
  total_images_audited: number;
  missing_alts_count: number;
  raw_filenames_count: number;
  excel_deliverable: string;
  images: ImageAssetItem[];
}

export interface ImageOptimizerRunOptions {
  url: string;
  keywordMapPath?: string;
  outputDir?: string;
  pythonPath?: string;
}

export interface ImageOptimizerResult {
  success: boolean;
  domain: string;
  excelPath?: string;
  jsonPath?: string;
  data?: SiteImagesOptimizedMap;
  stdout?: string;
  stderr?: string;
  error?: string;
}

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

export function getImageExcelPath(urlOrDomain: string, baseDir: string = "output"): string {
  const domain = extractDomain(urlOrDomain);
  return path.resolve(process.cwd(), baseDir, domain, "04-image-optimization.xlsx");
}

export function getImageOptimizedJsonPath(urlOrDomain: string, baseDir: string = "output"): string {
  const domain = extractDomain(urlOrDomain);
  return path.resolve(process.cwd(), baseDir, domain, "site-images-optimized.json");
}

export function loadSiteImagesOptimized(
  urlOrDomain: string,
  baseDir: string = "output"
): SiteImagesOptimizedMap | null {
  const filePath = getImageOptimizedJsonPath(urlOrDomain, baseDir);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as SiteImagesOptimizedMap;
}

export async function runImageOptimizer(
  options: ImageOptimizerRunOptions
): Promise<ImageOptimizerResult> {
  const domain = extractDomain(options.url);
  const baseDir = options.outputDir || "output";
  const pythonBin =
    options.pythonPath ||
    (fs.existsSync(path.resolve(process.cwd(), ".venv/bin/python3"))
      ? path.resolve(process.cwd(), ".venv/bin/python3")
      : "python3");

  const args = ["-m", "python.generators.image_optimizer", "--url", options.url];

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
      const excelPath = getImageExcelPath(options.url, baseDir);
      const jsonPath = getImageOptimizedJsonPath(options.url, baseDir);

      if (code === 0 && fs.existsSync(jsonPath)) {
        try {
          const raw = fs.readFileSync(jsonPath, "utf-8");
          const data = JSON.parse(raw) as SiteImagesOptimizedMap;
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
