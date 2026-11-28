/**
 * Unified AI SEO Model & Tool Orchestrator
 * Integrates Claude-SEO, Open-SEO, and MCP-GSC into SEO Studio's Unified Model System
 */

import { listGscProperties, getGscPerformanceOverview, compareGscPeriods, detectGscCannibalization, inspectGscUrl } from "../core/gsc/client.ts";
import { evaluateAiVisibility } from "../core/open-seo/ai-visibility.ts";
import { performKeywordResearch } from "../core/open-seo/keyword-research.ts";
import { analyzeBacklinkProfile } from "../core/open-seo/backlinks.ts";
import { AUDIT_ISSUE_TYPES } from "../core/open-seo/audit-issues.ts";
import { loadGoogleAlgorithmUpdates, listClaudeSeoAgents, getClaudeSeoAgentPrompt } from "../core/claude-seo/index.ts";
import { crawlWebsiteImages } from "../core/image-audit/crawler.ts";
import { crawlWebsiteHeadings } from "../core/heading-audit/crawler.ts";

export interface UnifiedToolDefinition {
  name: string;
  description: string;
  category: "technical" | "gsc" | "research" | "geo" | "content";
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
}

export const UNIFIED_SEO_TOOLS: UnifiedToolDefinition[] = [
  {
    name: "query_google_search_console",
    description: "Fetch live or simulated Google Search Console performance data (clicks, impressions, CTR, average position).",
    category: "gsc",
    parameters: {
      type: "object",
      properties: {
        siteUrl: { type: "string", description: "The GSC property URL (e.g. 'https://thenines.com/' or 'sc-domain:thenines.com')" },
        days: { type: "number", description: "Number of historical days to inspect (default: 28)" },
      },
      required: ["siteUrl"],
    },
  },
  {
    name: "inspect_url_in_gsc",
    description: "Inspect specific page URL indexing, crawl time, canonical chosen by Google, and robots.txt state.",
    category: "gsc",
    parameters: {
      type: "object",
      properties: {
        siteUrl: { type: "string", description: "The GSC property" },
        pageUrl: { type: "string", description: "The specific page address to inspect" },
      },
      required: ["siteUrl", "pageUrl"],
    },
  },
  {
    name: "detect_keyword_cannibalization",
    description: "Identify search queries where two or more pages compete for organic impressions and dilute CTR.",
    category: "gsc",
    parameters: {
      type: "object",
      properties: {
        siteUrl: { type: "string", description: "The site address" },
        days: { type: "number", description: "Days of query data to inspect" },
      },
      required: ["siteUrl"],
    },
  },
  {
    name: "research_keywords_and_gaps",
    description: "Perform keyword research with search volume, CPC, keyword difficulty, intent, and competitor content gap analysis.",
    category: "research",
    parameters: {
      type: "object",
      properties: {
        seedTerm: { type: "string", description: "Seed keyword or topic" },
        brand: { type: "string", description: "Optional property or brand name" },
        city: { type: "string", description: "Optional city" },
      },
      required: ["seedTerm"],
    },
  },
  {
    name: "analyze_ai_visibility_geo",
    description: "Estimate GEO readiness from on-page facts. AI-engine citation visibility is simulated only when ALLOW_SIMULATED_DATA is enabled; no live share-of-voice measurement is available.",
    category: "geo",
    parameters: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Domain name" },
        brandName: { type: "string", description: "Brand or property name" },
      },
      required: ["domain", "brandName"],
    },
  },
  {
    name: "analyze_backlink_profile",
    description: "Evaluate domain rating, referring domains, dofollow ratio, anchor text distribution, and link intersection opportunities.",
    category: "research",
    parameters: {
      type: "object",
      properties: {
        targetUrlOrDomain: { type: "string", description: "Domain or URL to inspect" },
      },
      required: ["targetUrlOrDomain"],
    },
  },
  {
    name: "audit_heading_structure",
    description: "Crawl public pages, parse rendered H1-H6 tags in document order, and generate hierarchy recommendations.",
    category: "technical",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Starting website URL" },
        maxPages: { type: "number", description: "Crawl page limit" },
      },
      required: ["url"],
    },
  },
  {
    name: "audit_image_optimization",
    description: "Crawl images, parse <img src>, <picture>, and CSS backgrounds, audit missing alt vs WCAG decorative, file sizes, and WebP/AVIF.",
    category: "technical",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Starting website URL" },
        maxPages: { type: "number", description: "Crawl page limit" },
      },
      required: ["url"],
    },
  },
  {
    name: "lookup_google_core_updates",
    description: "Query official Google Core algorithm update history, helpful content system milestones, and spam updates.",
    category: "content",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of recent updates to return" },
      },
      required: [],
    },
  },
];

export async function executeUnifiedTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  switch (toolName) {
    case "query_google_search_console": {
      const siteUrl = String(args.siteUrl || "");
      const days = Number(args.days) || 28;
      const overview = await getGscPerformanceOverview(siteUrl, days);
      const comparison = await compareGscPeriods(siteUrl, days);
      return { overview, comparison };
    }

    case "inspect_url_in_gsc": {
      return await inspectGscUrl(String(args.siteUrl || ""), String(args.pageUrl || ""));
    }

    case "detect_keyword_cannibalization": {
      const siteUrl = String(args.siteUrl || "");
      const days = Number(args.days) || 28;
      return await detectGscCannibalization(siteUrl, days);
    }

    case "research_keywords_and_gaps": {
      return performKeywordResearch(String(args.seedTerm || ""), {
        brand: typeof args.brand === "string" ? args.brand : undefined,
        city: typeof args.city === "string" ? args.city : undefined,
      });
    }

    case "analyze_ai_visibility_geo": {
      const domain = String(args.domain || "");
      const brand = String(args.brandName || "");
      return evaluateAiVisibility(domain, brand, [
        { prompt: `best luxury boutique hotel in ${brand}`, category: "Branded Discovery" },
        { prompt: `downtown hotel with rooftop restaurant`, category: "Dining & Lifestyle" },
        { prompt: `historic luxury hotel suites`, category: "Accommodations" },
      ]);
    }

    case "analyze_backlink_profile": {
      return analyzeBacklinkProfile(String(args.targetUrlOrDomain || ""));
    }

    case "audit_heading_structure": {
      return await crawlWebsiteHeadings(String(args.url || ""), {
        maxPages: Number(args.maxPages) || 15,
        delayMs: 50,
      });
    }

    case "audit_image_optimization": {
      return await crawlWebsiteImages(String(args.url || ""), {
        maxPages: Number(args.maxPages) || 15,
        delayMs: 50,
      });
    }

    case "lookup_google_core_updates": {
      const limit = Number(args.limit) || 5;
      return loadGoogleAlgorithmUpdates().slice(-limit).reverse();
    }

    default:
      throw new Error(`Unknown unified SEO tool: ${toolName}`);
  }
}

export function buildUnifiedSeoSystemPrompt(domain: string, brandName: string): string {
  const agents = listClaudeSeoAgents();
  const agentSummary = agents.map((a) => `- ${a.name} (${a.category})`).join("\n");

  return `You are the SEO Studio Unified Autonomous SEO AI Architect.
You possess combined expertise synthesized from SEO Studio, Claude-SEO, Open-SEO, and MCP-GSC.

CORE CAPABILITIES:
1. Technical SEO: Full website crawling, canonical integrity, robots.txt, sitemaps, image optimization (=IMAGE formula parity), and heading structure (H1–H6).
2. Google Search Console: Search analytics, period comparisons, keyword cannibalization detection, and URL inspection.
3. SEO Research: Search volume, CPC, keyword difficulty, search intent, competitor content gaps, and backlink authority.
4. Generative Engine Optimization (GEO): Share of voice and citation tracking across ChatGPT, Perplexity, Claude, and Google AI Overviews.
5. Google Core Update Resilience: Grounded in official Google algorithm update history.

ACTIVE TARGET PROFILE:
Domain: ${domain}
Brand: ${brandName}

SPECIALIZED PERSONAS LOADED:
${agentSummary}

OPERATIONAL PRINCIPLES:
- Ground every recommendation in empirical data (never fabricate traffic, search volumes, or rank numbers).
- Clearly separate verified findings from exploratory hypotheses.
- Adhere to WCAG 2.1 AA accessibility (e.g. recognize alt="" as valid decorative markup).
- Prioritize high-impact fixes using Effort vs Impact scoring.`;
}
