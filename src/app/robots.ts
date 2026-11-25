import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/platform"],
      },
    ],
    sitemap: "https://cogwheel-seo-templates.vercel.app/sitemap.xml",
  };
}
