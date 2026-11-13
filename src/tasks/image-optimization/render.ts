import { renderTabularSheetOutput } from "@/core/sheet-export";
import type { Property } from "@/lib/types";
import type { ImageOptimizationRowDraft, ImageOptimizationSummary } from "./schema";

export interface ImageOptimizationOutput {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  usedTemplateCopy: boolean;
  xlsxBase64: string;
  summary: ImageOptimizationSummary;
  rows: ImageOptimizationRowDraft[];
}

const HEADERS = ["Page URL", "Image URL", "Current Alt", "Proposed Alt", "Issue", "Recommendation"];

export async function renderImageOptimizationOutput(opts: {
  property: Pick<Property, "name" | "brand" | "city" | "state" | "url">;
  summary: ImageOptimizationSummary;
  rows: ImageOptimizationRowDraft[];
}): Promise<ImageOptimizationOutput> {
  const sheet = await renderTabularSheetOutput({
    title: `${opts.property.name} — Image & Alt Text Optimization`,
    sheetName: "Image Optimization",
    headers: HEADERS,
    rows: opts.rows.map((r) => [
      r.pageUrl,
      r.imageSrc,
      r.currentAlt || "-",
      r.proposedAlt,
      r.issue,
      r.recommendation,
    ]),
    templateEnvKey: "GOOGLE_TEMPLATE_SHEET_ID_IMAGES",
  });

  return {
    ...sheet,
    summary: opts.summary,
    rows: opts.rows,
  };
}

