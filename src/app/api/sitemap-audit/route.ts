import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  url: z.string().trim().min(3, "Please enter a valid URL or sitemap link"),
});

export interface SitemapCategory {
  name: string;
  count: number;
  urls: string[];
}

export interface DiscoveredUrl {
  url: string;
  category: string;
  depth: number;
  isHttps: boolean;
  hasTrailingSlash: boolean;
}

const CATEGORY_RULES: Array<{ name: string; pattern: RegExp }> = [
  { name: "Rooms & Suites", pattern: /\/rooms?\b|\/suites?\b|accommodat|guest-room|villas?/i },
  { name: "Dining & Bars", pattern: /\/dining\b|restaurant|bar\b|bistro|cafe|culinary|food|eat|lounge|rooftop/i },
  { name: "Amenities & Spa", pattern: /\/spa\b|wellness|pool|fitness|gym|amenit|golf|activities/i },
  { name: "Meetings & Events", pattern: /\/events?\b|meeting|conference|wedding|banquet|gatherings/i },
  { name: "Offers & Packages", pattern: /\/offers?\b|special|deals?|packages?|promotions?/i },
  { name: "Location & Guide", pattern: /\/location\b|explore|area|attractions|things-to-do|neighborhood|directions/i },
  { name: "About & Policies", pattern: /\/about\b|hotel-info|policies|faq|contact|careers|press/i },
];

function classifyUrl(urlStr: string): string {
  try {
    const pathname = new URL(urlStr).pathname;
    for (const rule of CATEGORY_RULES) {
      if (rule.pattern.test(pathname)) {
        return rule.name;
      }
    }
  } catch {
    // fallback
  }
  return "General & Core Pages";
}

function extractLocsFromXml(xmlText: string): string[] {
  const locRegex = /<loc>(https?:\/\/[^<]+)<\/loc>/gi;
  const matches = [...xmlText.matchAll(locRegex)];
  return matches.map((m) => m[1].trim());
}

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = requestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid URL" }, { status: 400 });
    }

    let inputUrl = parsed.data.url;
    if (!/^https?:\/\//i.test(inputUrl)) {
      inputUrl = `https://${inputUrl}`;
    }

    let sitemapUrl = inputUrl;
    if (!inputUrl.endsWith(".xml") && !inputUrl.includes("sitemap")) {
      const trimmed = inputUrl.replace(/\/+$/, "");
      sitemapUrl = `${trimmed}/sitemap.xml`;
    }

    let xmlText = "";
    let finalSitemapUrl = sitemapUrl;
    try {
      const res = await fetch(sitemapUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; CogwheelSEOSitemapBot/2.6; +https://cogwheel.hospitality)",
          Accept: "application/xml, text/xml, */*",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        // Try fallback sitemap_index.xml or index.xml
        const fallbackUrl = sitemapUrl.replace("/sitemap.xml", "/sitemap_index.xml");
        const fbRes = await fetch(fallbackUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; CogwheelSEOSitemapBot/2.6)",
            Accept: "application/xml, text/xml, */*",
          },
          signal: AbortSignal.timeout(8000),
        });
        if (fbRes.ok) {
          xmlText = await fbRes.text();
          finalSitemapUrl = fallbackUrl;
        } else {
          throw new Error(`Sitemap responded with HTTP ${res.status}`);
        }
      } else {
        xmlText = await res.text();
      }
    } catch (err: any) {
      return NextResponse.json(
        {
          error: `Could not fetch XML sitemap from ${sitemapUrl}: ${err.message}`,
          sitemapUrl,
        },
        { status: 404 }
      );
    }

    let rawUrls = extractLocsFromXml(xmlText);

    // If sitemap index contains sub-sitemaps
    const subSitemaps = rawUrls.filter((u) => u.endsWith(".xml"));
    if (subSitemaps.length > 0 && subSitemaps.length === rawUrls.length) {
      // Fetch up to 3 sub-sitemaps
      const discoveredSubUrls: string[] = [];
      for (const subUrl of subSitemaps.slice(0, 3)) {
        try {
          const subRes = await fetch(subUrl, {
            headers: { "User-Agent": "CogwheelSEOSitemapBot/2.6" },
            signal: AbortSignal.timeout(5000),
          });
          if (subRes.ok) {
            const subXml = await subRes.text();
            discoveredSubUrls.push(...extractLocsFromXml(subXml));
          }
        } catch {
          // ignore individual sub-sitemap failures
        }
      }
      if (discoveredSubUrls.length > 0) {
        rawUrls = discoveredSubUrls;
      }
    }

    // Deduplicate and cap at 300 URLs
    const uniqueUrls = Array.from(new Set(rawUrls)).slice(0, 300);

    if (uniqueUrls.length === 0) {
      return NextResponse.json(
        {
          error: `Sitemap found at ${finalSitemapUrl} but contained 0 valid <loc> URLs.`,
          sitemapUrl: finalSitemapUrl,
        },
        { status: 422 }
      );
    }

    // Process & classify URLs
    const categoryMap: Record<string, string[]> = {};
    const discoveredList: DiscoveredUrl[] = [];
    let httpCount = 0;
    let trailingSlashCount = 0;

    for (const u of uniqueUrls) {
      const category = classifyUrl(u);
      if (!categoryMap[category]) categoryMap[category] = [];
      categoryMap[category].push(u);

      const isHttps = u.startsWith("https://");
      if (!isHttps) httpCount++;

      let pathname = "";
      try {
        pathname = new URL(u).pathname;
      } catch {}
      const hasTrailing = pathname.endsWith("/");
      if (hasTrailing) trailingSlashCount++;

      const segments = pathname.split("/").filter(Boolean);
      discoveredList.push({
        url: u,
        category,
        depth: segments.length,
        isHttps,
        hasTrailingSlash: hasTrailing,
      });
    }

    const categories: SitemapCategory[] = Object.entries(categoryMap).map(([name, urls]) => ({
      name,
      count: urls.length,
      urls: urls.slice(0, 10),
    }));

    // Calculate quality health score
    let healthScore = 100;
    const issues: string[] = [];

    if (httpCount > 0) {
      healthScore -= Math.min(25, httpCount * 5);
      issues.push(`Found ${httpCount} non-secure (HTTP) URLs in sitemap`);
    }

    const slashRatio = trailingSlashCount / uniqueUrls.length;
    if (slashRatio > 0.1 && slashRatio < 0.9) {
      healthScore -= 10;
      issues.push("Inconsistent trailing slash usage across sitemap URLs");
    }

    if (!categoryMap["Rooms & Suites"] || categoryMap["Rooms & Suites"].length === 0) {
      issues.push("No explicit room or accommodation URLs identified in sitemap");
    }

    if (!categoryMap["Dining & Bars"] || categoryMap["Dining & Bars"].length === 0) {
      issues.push("No dining/restaurant URLs detected in sitemap");
    }

    return NextResponse.json({
      success: true,
      sitemapUrl: finalSitemapUrl,
      totalUrls: uniqueUrls.length,
      categories,
      discoveredUrls: discoveredList,
      healthScore: Math.max(50, healthScore),
      issues,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to parse sitemap" }, { status: 500 });
  }
}
