import type {
  SitemapNavigationOptimizationDraft,
  SitemapNavigationOptimizationInput,
} from "./schema";

export function buildSitemapNavigationPrompt(opts: {
  input: SitemapNavigationOptimizationInput;
  feedback?: string[];
}): { system: string; prompt: string } {
  const system = `You are a Principal Technical SEO & Information Architecture Specialist at Cogwheel SEO Studio.
Analyze hotel XML sitemaps, internal link architecture, and click depth.
Output strictly valid JSON conforming to the requested schema.`;

  const prompt = `Hotel Property:
${opts.input.property.name} (${opts.input.property.brand})
Website: ${opts.input.property.url}
Location: ${opts.input.property.city}, ${opts.input.property.state}

Sitemap XML URLs submitted:
${opts.input.sitemapXmlUrls ? opts.input.sitemapXmlUrls.join("\n") : "None (Auto-discover)"}

Crawled Pages (${opts.input.crawledPages?.length ?? 0} pages):
${(opts.input.crawledPages ?? []).slice(0, 20).map((p) => `- ${p.url} (status: ${p.statusCode}, depth: ${p.depth}, inSitemap: ${p.inSitemap})`).join("\n")}

${opts.feedback && opts.feedback.length > 0 ? `PREVIOUS VALIDATION ERRORS:\n${opts.feedback.join("\n")}\n` : ""}

Generate a technical sitemap & navigation optimization plan. Output JSON:
{
  "xmlSitemapHealth": {
    "totalSitemapUrls": integer,
    "valid200Urls": integer,
    "non200UrlsInSitemap": string[],
    "orphanUrlsCount": integer
  },
  "clickDepthAnalysis": [
    {
      "url": string (url),
      "depth": integer,
      "internalInlinksCount": integer,
      "status": "optimal" | "acceptable" | "deep_warning" | "orphan",
      "recommendation": string
    }
  ],
  "navigationGaps": string[],
  "generatedXmlSitemapEntries": [
    {
      "loc": string (url),
      "lastmod": string (YYYY-MM-DD),
      "changefreq": "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never",
      "priority": number (0.0 to 1.0),
      "pageType": string
    }
  ]
}`;

  return { system, prompt };
}

export function parseSitemapNavigationDraft(
  rawText: string,
): SitemapNavigationOptimizationDraft {
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ?? [null, rawText];
  const cleaned = jsonMatch[1]?.trim() ?? rawText.trim();
  return JSON.parse(cleaned);
}
