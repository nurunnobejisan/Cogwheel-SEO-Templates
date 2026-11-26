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
    sitemap: "https://seo-studio-one.vercel.app/sitemap.xml",
  };
}
