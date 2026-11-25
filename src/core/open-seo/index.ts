import {
  AUDIT_ISSUE_TYPES,
  type AuditIssueDescriptor,
} from "./audit-issues.ts";
import {
  evaluateAiVisibility,
  type AiVisibilitySummary,
} from "./ai-visibility.ts";
import {
  performKeywordResearch,
  type KeywordMetrics,
} from "./keyword-research.ts";
import {
  analyzeBacklinkProfile,
  type BacklinkProfileSummary,
} from "./backlinks.ts";

export * from "./audit-issues.ts";
export * from "./ai-visibility.ts";
export * from "./keyword-research.ts";
export * from "./backlinks.ts";

export const DEFAULT_AUDIT_ISSUES: AuditIssueDescriptor[] = Object.values(AUDIT_ISSUE_TYPES);

export function evaluateAuditIssues(
  foundIssues: Array<{ issueId: string; affectedUrls: string[] }>
): {
  totalIssuesFound: number;
  overallHealthScore: number;
  highPriorityCount: number;
  issueDetails: Array<{ issueId: string; title: string; severity: string; urls: string[] }>;
} {
  let criticalCount = 0;
  let warningCount = 0;

  const details = foundIssues.map((item) => {
    const desc = AUDIT_ISSUE_TYPES[item.issueId] || {
      title: item.issueId,
      severity: "warning",
      category: "onpage",
      explanation: "",
      howToFix: "",
    };
    if (desc.severity === "critical") criticalCount += 1;
    if (desc.severity === "warning") warningCount += 1;
    return {
      issueId: item.issueId,
      title: desc.title,
      severity: desc.severity,
      urls: item.affectedUrls,
    };
  });

  const penalty = criticalCount * 15 + warningCount * 6;
  const overallHealthScore = Math.max(0, 100 - penalty);

  return {
    totalIssuesFound: foundIssues.length,
    overallHealthScore,
    highPriorityCount: criticalCount + warningCount,
    issueDetails: details,
  };
}

export async function generateAiVisibilityReport(options: {
  brandName: string;
  domain: string;
  targetQueries?: string[];
}): Promise<{
  brandName: string;
  domain: string;
  overallVisibilityScore: number;
  entityClarityScore: number;
  engineBreakdown: Record<string, number>;
  recommendations: string[];
  dataAvailable: boolean;
}> {
  const queryStrings = options.targetQueries && options.targetQueries.length > 0
    ? options.targetQueries
    : [`best hotel ${options.domain}`, `official site ${options.brandName}`];

  const prompts = queryStrings.map((q) => ({
    prompt: q,
    category: "Hospitality & Amenities",
    intent: "informational" as const,
  }));

  const res = evaluateAiVisibility(options.domain, options.brandName, prompts);

  // Only surface engine figures that were actually produced. No fabricated
  // fallback numbers — an unconnected source yields zeroes and dataAvailable:false.
  return {
    brandName: options.brandName,
    domain: options.domain,
    overallVisibilityScore: res.overallVisibilityScore,
    entityClarityScore: res.dataAvailable ? res.overallVisibilityScore : 0,
    engineBreakdown: {
      googleAiOverviews: res.engineRankings["google_ai_overview"]?.shareOfVoicePct ?? 0,
      perplexity: res.engineRankings["perplexity"]?.shareOfVoicePct ?? 0,
      chatgptSearch: res.engineRankings["chatgpt"]?.shareOfVoicePct ?? 0,
      claude: res.engineRankings["claude"]?.shareOfVoicePct ?? 0,
    },
    recommendations: res.geoRecommendations,
    dataAvailable: res.dataAvailable,
  };
}

export async function generateKeywordSuggestions(options: {
  seedKeyword: string;
  targetCountry?: string;
}): Promise<Array<{
  keyword: string;
  searchVolume: number;
  difficulty: number;
  cpc: number;
  intent: string;
}>> {
  const research = performKeywordResearch(options.seedKeyword);
  return research.keywords.map((k) => ({
    keyword: k.keyword,
    searchVolume: k.searchVolume,
    difficulty: k.keywordDifficulty,
    cpc: k.cpcUsd,
    intent: k.searchIntent,
  }));
}

export async function analyzeContentGaps(options: {
  primaryUrl: string;
  competitorUrls: string[];
}): Promise<{
  gapCount: number;
  gaps: Array<{
    keyword: string;
    searchVolume: number;
    difficulty: number;
    cpc: number;
    intent: string;
    opportunityScore: number;
  }>;
}> {
  const seed = new URL(options.primaryUrl.startsWith("http") ? options.primaryUrl : `https://${options.primaryUrl}`).hostname;
  const research = performKeywordResearch(seed);
  return {
    gapCount: research.contentGaps.length,
    gaps: research.keywords.filter((k) => k.contentGapOpportunity).map((k) => ({
      keyword: k.keyword,
      searchVolume: k.searchVolume,
      difficulty: k.keywordDifficulty,
      cpc: k.cpcUsd,
      intent: k.searchIntent,
      opportunityScore: Math.round((k.searchVolume / 100) * (100 - k.keywordDifficulty) / 10),
    })),
  };
}

export async function getBacklinkProfile(domain: string): Promise<BacklinkProfileSummary> {
  return analyzeBacklinkProfile(domain);
}
