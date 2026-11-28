/**
 * Writable data directory resolution.
 *
 * Locally we write into the repo's `data/` folder. On Vercel (and any
 * read-only/serverless filesystem) the deployment is immutable, so we fall
 * back to the OS temp directory. Set `SEO_STUDIO_DATA_DIR` to point at a real
 * volume or mounted disk when durable storage is required.
 */

import os from "node:os";
import path from "node:path";

export function seoStudioDataDir(): string {
  if (process.env.SEO_STUDIO_DATA_DIR) return process.env.SEO_STUDIO_DATA_DIR;
  if (process.env.VERCEL) return path.join(os.tmpdir(), "seo-studio-data");
  return path.join(process.cwd(), "data");
}

export function seoStudioDataFile(name: string): string {
  return path.join(seoStudioDataDir(), name);
}
