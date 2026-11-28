/**
 * SEO Keyword Research & Content Gap Engine
 * Adapted from open-seo (every-app/open-seo) under MIT License
 *
 * Integrity note (see docs/REPOSITORY_AUDIT.md, C2):
 * Search volume, CPC, keyword difficulty and trending rates require a paid
 * keyword-data provider. Without one, this module returns an empty result set
 * with `dataSource: "unavailable"` rather than inventing plausible numbers.
 * Synthetic values appear only when `ALLOW_SIMULATED_DATA` is enabled.
 */

import { isSimulatedDataAllowed } from "../data-policy.ts";

export interface KeywordMetrics {
  keyword: string;
  searchVolume: number;
  cpcUsd: number;
  competition: "low" | "medium" | "high";
  keywordDifficulty: number; // 0 to 100
  searchIntent: "informational" | "commercial" | "transactional" | "navigational";
  trendingRatePct: number; // e.g. +14% YoY
  serpFeatures: Array<"featured_snippet" | "people_also_ask" | "local_pack" | "images" | "ai_overview">;
  contentGapOpportunity: boolean;
  targetLandingPageSuggestion: string;
}

export interface KeywordResearchSummary {
  seedTerm: string;
  totalKeywordsFound: number;
  totalSearchVolume: number;
  averageCpc: number;
  keywords: KeywordMetrics[];
  contentGaps: Array<{
    theme: string;
    missingKeywordKeywords: string[];
    potentialTrafficLiftMonthly: number;
    recommendedAction: string;
  }>;
  /** Where the metrics came from — never claim a provider that isn't connected. */
  dataSource: "provider" | "simulated" | "unavailable";
}

export function performKeywordResearch(
  seedTerm: string,
  propertyContext?: { brand?: string; city?: string; state?: string }
): KeywordResearchSummary {
  // Honest default: no keyword-volume provider is connected.
  if (!isSimulatedDataAllowed()) {
    return {
      seedTerm,
      totalKeywordsFound: 0,
      totalSearchVolume: 0,
      averageCpc: 0,
      keywords: [],
      contentGaps: [],
      dataSource: "unavailable",
    };
  }

  const city = propertyContext?.city || "Portland";
  const brand = propertyContext?.brand || "Example Hotel";

  const keywords: KeywordMetrics[] = [
    {
      keyword: `${brand.toLowerCase()} ${city.toLowerCase()}`,
      searchVolume: 4400,
      cpcUsd: 1.85,
      competition: "high",
      keywordDifficulty: 38,
      searchIntent: "navigational",
      trendingRatePct: 8,
      serpFeatures: ["local_pack", "people_also_ask", "ai_overview", "images"],
      contentGapOpportunity: false,
      targetLandingPageSuggestion: "/",
    },
    {
      keyword: `downtown ${city.toLowerCase()} luxury hotels`,
      searchVolume: 2900,
      cpcUsd: 3.4,
      competition: "high",
      keywordDifficulty: 54,
      searchIntent: "commercial",
      trendingRatePct: 12,
      serpFeatures: ["local_pack", "featured_snippet", "ai_overview"],
      contentGapOpportunity: true,
      targetLandingPageSuggestion: "/accommodations/",
    },
    {
      keyword: `best boutique hotels in ${city.toLowerCase()} oregon`,
      searchVolume: 1600,
      cpcUsd: 2.75,
      competition: "medium",
      keywordDifficulty: 42,
      searchIntent: "informational",
      trendingRatePct: 15,
      serpFeatures: ["featured_snippet", "people_also_ask", "ai_overview"],
      contentGapOpportunity: true,
      targetLandingPageSuggestion: "/our-story/",
    },
    {
      keyword: `rooftop restaurant ${city.toLowerCase()}`,
      searchVolume: 3600,
      cpcUsd: 1.2,
      competition: "medium",
      keywordDifficulty: 29,
      searchIntent: "transactional",
      trendingRatePct: 22,
      serpFeatures: ["local_pack", "images", "ai_overview"],
      contentGapOpportunity: false,
      targetLandingPageSuggestion: "/dining/rooftop/",
    },
    {
      keyword: `historic historic building ${city.toLowerCase()}`,
      searchVolume: 880,
      cpcUsd: 0.65,
      competition: "low",
      keywordDifficulty: 18,
      searchIntent: "informational",
      trendingRatePct: 5,
      serpFeatures: ["featured_snippet", "images"],
      contentGapOpportunity: true,
      targetLandingPageSuggestion: "/our-story/history/",
    },
    {
      keyword: `pet friendly luxury hotels ${city.toLowerCase()}`,
      searchVolume: 1200,
      cpcUsd: 2.1,
      competition: "medium",
      keywordDifficulty: 35,
      searchIntent: "commercial",
      trendingRatePct: 18,
      serpFeatures: ["local_pack", "people_also_ask"],
      contentGapOpportunity: true,
      targetLandingPageSuggestion: "/amenities/pet-friendly/",
    },
    {
      keyword: `downtown ${city.toLowerCase()} meeting event venues`,
      searchVolume: 720,
      cpcUsd: 4.8,
      competition: "high",
      keywordDifficulty: 46,
      searchIntent: "transactional",
      trendingRatePct: 9,
      serpFeatures: ["local_pack", "ai_overview"],
      contentGapOpportunity: true,
      targetLandingPageSuggestion: "/meetings-events/",
    },
  ];

  const totalSearchVolume = keywords.reduce((sum, k) => sum + k.searchVolume, 0);
  const averageCpc =
    keywords.length > 0
      ? Math.round((keywords.reduce((sum, k) => sum + k.cpcUsd, 0) / keywords.length) * 100) / 100
      : 0;

  return {
    seedTerm,
    totalKeywordsFound: keywords.length,
    totalSearchVolume,
    averageCpc,
    keywords,
    contentGaps: [
      {
        theme: "Pet-Friendly Luxury Travel",
        missingKeywordKeywords: [`pet friendly luxury hotels ${city.toLowerCase()}`, "dog friendly hotel downtown"],
        potentialTrafficLiftMonthly: 650,
        recommendedAction:
          "Build a dedicated pet amenities landing page with pet policies, local dog park map, and JSON-LD Hotel schema.",
      },
      {
        theme: "Historic Architecture & Art Tourism",
        missingKeywordKeywords: [`historic historic building ${city.toLowerCase()}`, "curated hotel art collection"],
        potentialTrafficLiftMonthly: 420,
        recommendedAction:
          "Publish an architectural guide highlighting the historic department store restoration and contemporary art gallery floor.",
      },
    ],
    dataSource: "simulated",
  };
}
