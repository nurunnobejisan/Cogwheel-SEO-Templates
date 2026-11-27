import type { MetadataRoute } from "next";
import { TEMPLATES_DATA } from "@/packs/hotel/templates";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://seo-studio-one.vercel.app";
  const lastModified = new Date();

  const coreRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/templates`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/strategy-matrix`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/architecture`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  const templateRoutes: MetadataRoute.Sitemap = TEMPLATES_DATA.map((tmpl) => ({
    url: `${baseUrl}/templates/${tmpl.categorySlug}/${tmpl.slug}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...coreRoutes, ...templateRoutes];
}
