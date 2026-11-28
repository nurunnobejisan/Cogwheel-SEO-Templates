import { execFileSync } from "node:child_process";
import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";
import { TEMPLATES_DATA } from "@/data/templates";

/** Commit date at build time; no per-request `new Date()` churn. */
function buildDate(): Date {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  try {
    const iso = execFileSync("git", sha ? ["show", "-s", "--format=%cI", sha] : ["log", "-1", "--format=%cI"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const date = new Date(iso);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  } catch {
    // No git metadata available (e.g. a bare deployment artifact).
  }
  return new Date(0);
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = brand.siteUrl;
  const lastModified = buildDate();

  const coreRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified, changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/templates`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/strategy-matrix`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/architecture`, lastModified, changeFrequency: "monthly", priority: 0.7 },
  ];

  // Template records carry no updatedAt field, so they share the commit date.
  const templateRoutes: MetadataRoute.Sitemap = TEMPLATES_DATA.map((tmpl) => ({
    url: `${baseUrl}/templates/${tmpl.categorySlug}/${tmpl.slug}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...coreRoutes, ...templateRoutes];
}
