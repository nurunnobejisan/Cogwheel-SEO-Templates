import { z } from "zod";

export const sitemapUrlEntrySchema = z.object({
  loc: z.string().url(),
  lastmod: z.string().optional(),
  changefreq: z
    .enum(["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"])
    .default("weekly"),
  priority: z.number().min(0.0).max(1.0).default(0.8),
  pageType: z.string().default("general"),
});

export const clickDepthAuditItemSchema = z.object({
  url: z.string().url(),
  depth: z.number().int().nonnegative(),
  internalInlinksCount: z.number().int().nonnegative(),
  status: z.enum(["optimal", "acceptable", "deep_warning", "orphan"]),
  recommendation: z.string().min(3),
});

export const sitemapNavigationOptimizationInputSchema = z.object({
  propertyId: z.string().uuid().optional(),
  property: z.object({
    name: z.string().min(1),
    brand: z.string().default("Independent"),
    city: z.string().min(1),
    state: z.string().length(2),
    url: z.string().url(),
  }),
  sitemapXmlUrls: z.array(z.string().url()).optional(),
  crawledPages: z
    .array(
      z.object({
        url: z.string().url(),
        statusCode: z.number().int(),
        inSitemap: z.boolean().default(false),
        depth: z.number().int().default(1),
        internalLinks: z.array(z.string()).default([]),
      }),
    )
    .optional(),
});

export type SitemapNavigationOptimizationInput = z.infer<
  typeof sitemapNavigationOptimizationInputSchema
>;

export const sitemapNavigationOptimizationDraftSchema = z.object({
  xmlSitemapHealth: z.object({
    totalSitemapUrls: z.number().int().nonnegative(),
    valid200Urls: z.number().int().nonnegative(),
    non200UrlsInSitemap: z.array(z.string()).default([]),
    orphanUrlsCount: z.number().int().nonnegative(),
  }),
  clickDepthAnalysis: z.array(clickDepthAuditItemSchema),
  navigationGaps: z.array(z.string()),
  generatedXmlSitemapEntries: z.array(sitemapUrlEntrySchema),
});

export type SitemapNavigationOptimizationDraft = z.infer<
  typeof sitemapNavigationOptimizationDraftSchema
>;
