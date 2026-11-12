import type { KeywordRecord, MatrixRow, Property, SitemapPage } from "@/lib/types";

export type SearchIntent = "transactional" | "commercial" | "local" | "informational" | "navigational";

export interface GeoSeoInsights {
  brandedCount: number;
  nonBrandedCount: number;
  intentBreakdown: Record<SearchIntent, number>;
  conversationalQueries: Array<{ keyword: string; volume: number }>;
  localOpportunities: Array<{ keyword: string; volume: number }>;
  cannibalizationWarnings: Array<{ keyword: string; pageIds: string[] }>;
  pageConfidence: Record<string, { score: number; reason: string }>;
  faqOpportunities: string[];
  structuredDataRecommendations: string[];
}

const INTERROGATIVE_RE = /^(how|what|where|when|why|who|which|can|do|does|is|are)\b/i;
const QUESTION_RE = /^(how|what|where|when|why|who|which|can|do|does|is|are)\b|\b(near me|best|top|vs|worth it)\b/i;
const TRANSACTIONAL_RE = /\b(book|booking|reserve|reservation|rates?|prices?|deals?|packages?|discount|stay|rooms?|suites?)\b/i;
const COMMERCIAL_RE = /\b(best|top|luxury|boutique|pet[- ]friendly|review|reviews|compare|boutique)\b/i;
const LOCAL_RE = /\b(near|downtown|midtown|airport|university|stadium|arena|district|neighborhood)\b/i;

export function classifyIntent(keyword: string, rawIntent?: string | null): SearchIntent {
  const raw = (rawIntent ?? "").toLowerCase();
  if (raw.includes("transactional")) return "transactional";
  if (raw.includes("commercial")) return "commercial";
  if (raw.includes("navigational")) return "navigational";
  if (raw.includes("informational")) return "informational";

  if (INTERROGATIVE_RE.test(keyword)) return "informational";
  if (TRANSACTIONAL_RE.test(keyword)) return "transactional";
  if (LOCAL_RE.test(keyword)) return "local";
  if (COMMERCIAL_RE.test(keyword)) return "commercial";
  if (QUESTION_RE.test(keyword)) return "informational";
  return "commercial";
}

export function isBrandedKeyword(keyword: string, property: Property): boolean {
  const kw = keyword.toLowerCase();
  const cityTokens = new Set(
    [property.city, property.state]
      .join(" ")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
  const stopWords = new Set(["hotel", "hotels", "resort", "inn", "suites", "collection", "hilton"]);
  const brandTokens = [property.name, property.brand ?? ""]
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !stopWords.has(t) && !cityTokens.has(t));

  if (property.brand && property.brand.trim().length >= 3 && kw.includes(property.brand.trim().toLowerCase())) {
    return true;
  }
  return brandTokens.some((token) => kw.includes(token));
}

/**
 * Free-first deterministic SEO/GEO analyzer: computes intent breakdown,
 * branded/non-branded split, conversational GEO questions, cannibalization
 * risks, and mapping confidence scores without requiring paid AI APIs.
 */
export function analyzeGeoSeo(
  keywords: KeywordRecord[],
  matrix: MatrixRow[],
  pages: SitemapPage[],
  property: Property,
): GeoSeoInsights {
  const intentBreakdown: Record<SearchIntent, number> = {
    transactional: 0,
    commercial: 0,
    local: 0,
    informational: 0,
    navigational: 0,
  };

  let brandedCount = 0;
  let nonBrandedCount = 0;
  const conversationalQueries: Array<{ keyword: string; volume: number }> = [];
  const localOpportunities: Array<{ keyword: string; volume: number }> = [];

  for (const kw of keywords) {
    const intent = classifyIntent(kw.keyword, kw.intent);
    intentBreakdown[intent]++;

    if (isBrandedKeyword(kw.keyword, property)) {
      brandedCount++;
    } else {
      nonBrandedCount++;
    }

    if (QUESTION_RE.test(kw.keyword) && conversationalQueries.length < 15) {
      conversationalQueries.push({ keyword: kw.keyword, volume: kw.volume });
    }
    if (LOCAL_RE.test(kw.keyword) && localOpportunities.length < 15) {
      localOpportunities.push({ keyword: kw.keyword, volume: kw.volume });
    }
  }

  // Detect duplicate primary or overlapping target keywords across active pages
  const kwToPages = new Map<string, string[]>();
  for (const row of matrix) {
    if (!row.primary) continue;
    const key = row.primary.keyword.toLowerCase().trim();
    const list = kwToPages.get(key) ?? [];
    list.push(row.pageId);
    kwToPages.set(key, list);
  }
  const cannibalizationWarnings = [...kwToPages.entries()]
    .filter(([, pageIds]) => pageIds.length > 1)
    .map(([keyword, pageIds]) => ({ keyword, pageIds }));

  // Confidence score per mapped page based on SV, KD, flags, and assignment completeness
  const pageConfidence: Record<string, { score: number; reason: string }> = {};
  for (const row of matrix) {
    if (!row.primary) {
      pageConfidence[row.pageId] = { score: 0, reason: "No primary keyword assigned" };
      continue;
    }
    let score = 70;
    const reasons: string[] = [];
    if (row.primary.volume >= 500) {
      score += 15;
      reasons.push("strong volume");
    } else if (row.primary.volume >= 100) {
      score += 8;
      reasons.push("moderate volume");
    }
    if (row.primary.kd !== null && row.primary.kd <= 35) {
      score += 10;
      reasons.push("achievable KD");
    }
    if (row.secondary) {
      score += 5;
      reasons.push("secondary paired");
    }
    if (row.flags.length > 0) {
      score -= Math.min(25, row.flags.length * 10);
      reasons.push(`flags: ${row.flags.join(", ")}`);
    }
    pageConfidence[row.pageId] = {
      score: Math.max(0, Math.min(100, score)),
      reason: reasons.join("; ") || "baseline match",
    };
  }

  const faqOpportunities = conversationalQueries
    .slice(0, 6)
    .map((q) => `Answer "${q.keyword}" (${q.volume.toLocaleString()} SV) in an on-page FAQ block.`);

  const activeIds = new Set(pages.filter((p) => p.active).map((p) => p.id));
  const structuredDataRecommendations = [
    "Hotel / LodgingBusiness schema with exact NAP, geo coordinates, and amenityFeature list",
    ...(faqOpportunities.length > 0 ? ["FAQPage schema on Home or Hotel Info page for conversational AI citations"] : []),
    ...(activeIds.has("dining") || activeIds.has("bar") ? ["Restaurant / BarOrPub schema for on-site F&B outlets"] : []),
    ...(activeIds.has("events") || activeIds.has("meetings") ? ["EventVenue / MeetingRoom capacity schema"] : []),
  ];

  return {
    brandedCount,
    nonBrandedCount,
    intentBreakdown,
    conversationalQueries,
    localOpportunities,
    cannibalizationWarnings,
    pageConfidence,
    faqOpportunities,
    structuredDataRecommendations,
  };
}
