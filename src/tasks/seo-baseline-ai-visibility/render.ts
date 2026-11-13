import { isGoogleConfigured } from "@/core/google";
import type { TaskRunFlag } from "@/core/runs";
import { cloneDriveTemplate, fillSlidesPlaceholders, resolveTemplateId } from "@/core/templates";
import { summarizeTaskFlags, type TaskFlagSummary } from "@/tasks/contract";
import {
  DEFAULT_BASELINE_SLIDES_TEMPLATE_ID,
  type SeoBaselineDraft,
  type SeoBaselineInput,
} from "./schema";

export interface BaselineSlidePreview {
  slideNumber: number;
  title: string;
  content: Record<string, string | number | string[]>;
}

export interface SeoBaselineOutput {
  propertyName: string;
  presentationId: string | null;
  presentationUrl: string | null;
  usedTemplateCopy: boolean;
  slides: BaselineSlidePreview[];
  flagSummary: TaskFlagSummary;
}

export async function renderSeoBaselineDeck(opts: {
  input: SeoBaselineInput;
  draft: SeoBaselineDraft;
  reconciledTotalKeywords?: number;
  indexedPages?: number;
  flags: TaskRunFlag[];
}): Promise<{ outputUrl: string | null; output: SeoBaselineOutput }> {
  const { input, draft } = opts;
  const sm = input.semrushSummary;
  const ai = input.aiVisibility;
  const totalKw = opts.reconciledTotalKeywords ?? sm.totalRankingKeywords ?? 0;
  const nonBrandKw = sm.nonBrandKeywords ?? 0;
  const brandKw = sm.brandKeywords ?? 0;
  const indexedPages = opts.indexedPages ?? sm.indexedPages ?? 0;

  const slides: BaselineSlidePreview[] = [
    {
      slideNumber: 1,
      title: `${input.property.name} — SEO Baseline & AI Visibility`,
      content: { websiteName: input.property.name, url: input.property.url },
    },
    {
      slideNumber: 3,
      title: "Your Hotel's Summary",
      content: {
        clientUrl: input.property.url,
        organicTraffic: sm.organicTraffic ?? "N/A",
        rankingKeywords: totalKw,
        referringDomains: sm.referringDomains ?? "N/A",
        backlinks: sm.backlinks ?? "N/A",
      },
    },
    {
      slideNumber: 4,
      title: "Keywords & Pages Your Hotel Ranks For",
      content: {
        totalRankingKeywords: totalKw,
        nonBrandKeywords: nonBrandKw,
        brandKeywords: brandKw,
        indexedPages,
        keywordReportUrl: sm.keywordReportUrl || "Pending report link",
      },
    },
    {
      slideNumber: 5,
      title: "Organic Traffic & Ranking Trends - Mobile",
      content: {
        organicTraffic: draft.mobileTrafficSummary,
        rankingKeywords: draft.mobileKeywordsSummary,
        analysis: draft.mobileAnalysis,
      },
    },
    {
      slideNumber: 6,
      title: "Organic Traffic & Ranking Trends - Desktop",
      content: {
        organicTraffic: draft.desktopTrafficSummary,
        rankingKeywords: draft.desktopKeywordsSummary,
        analysis: draft.desktopAnalysis,
      },
    },
    {
      slideNumber: 7,
      title: "Compsets Baseline",
      content: { analysis: draft.compSetTakeaway },
    },
    {
      slideNumber: 8,
      title: "AI Visibility Baseline",
      content: {
        visibilityScore: ai.visibilityScore !== undefined ? `${ai.visibilityScore}%` : "N/A",
        brandSentiment: ai.brandSentiment ?? "N/A",
        brandMentions: ai.brandMentions ?? "N/A",
        pagesCited: ai.pagesCited ?? "N/A",
        shareOfVoice: ai.shareOfVoice !== undefined ? `${ai.shareOfVoice}%` : "N/A",
        topCitedDomains: ai.topCitedDomains,
        takeaway: draft.aiVisibilityTakeaway,
      },
    },
  ];

  let presentationId: string | null = null;
  let presentationUrl: string | null = null;
  let usedTemplateCopy = false;

  const templateId =
    resolveTemplateId("GOOGLE_TEMPLATE_BASELINE_DOC_ID", input.templateId) ||
    DEFAULT_BASELINE_SLIDES_TEMPLATE_ID;

  if (isGoogleConfigured()) {
    const cloned = await cloneDriveTemplate({
      templateId,
      title: `${input.property.name} — SEO Baseline & AI Visibility`,
    });
    presentationId = cloned.fileId;
    presentationUrl = `https://docs.google.com/presentation/d/${cloned.fileId}/edit`;
    usedTemplateCopy = true;

    await fillSlidesPlaceholders(cloned.fileId, {
      "[WEBSITE NAME]": input.property.name,
      "[insert the client URL HERE]": input.property.url,
      "[update with client numbers]": `${input.property.name} Baseline`,
      "[insert number from SEMRush report]": String(sm.organicTraffic ?? "N/A"),
      "[insert the number from the ranking report here. This MUST  \t\t\t\t\tMATCH the number on slide 5]":
        String(totalKw),
      "[insert number of pages]": String(indexedPages),
      "[EXAMPLE ANALYSIS]": draft.mobileAnalysis,
      "This is an example screenshot please remove this and add the property relevant screenshot.": "",
      "These are example screenshots, please remove and add the property relevant screenshot.": "",
    });
  }

  return {
    outputUrl: presentationUrl,
    output: {
      propertyName: input.property.name,
      presentationId,
      presentationUrl,
      usedTemplateCopy,
      slides,
      flagSummary: summarizeTaskFlags(opts.flags),
    },
  };
}
