import { renderTabularSheetOutput } from "@/core/sheet-export";
import type { Property } from "@/lib/types";
import type { DuplicateContentRowDraft, DuplicateContentSummary } from "./schema";

export interface DuplicateContentOutput {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  usedTemplateCopy: boolean;
  xlsxBase64: string;
  summary: DuplicateContentSummary;
  rows: DuplicateContentRowDraft[];
}

const HEADERS = [
  "Cluster Type",
  "Primary URL",
  "Affected URLs",
  "Severity",
  "Recommended Action",
  "Rationale",
];

export async function renderDuplicateContentOutput(opts: {
  property: Pick<Property, "name" | "brand" | "city" | "state" | "url">;
  summary: DuplicateContentSummary;
  rows: DuplicateContentRowDraft[];
}): Promise<DuplicateContentOutput> {
  const sheet = await renderTabularSheetOutput({
    title: `${opts.property.name} — Duplicate & Thin Content Audit`,
    sheetName: "Duplicate Content",
    headers: HEADERS,
    rows: opts.rows.map((r) => [
      r.clusterType,
      r.primaryUrl,
      r.affectedUrls.join(" | "),
      r.severity,
      r.recommendedAction,
      r.rationale,
    ]),
    templateEnvKey: "GOOGLE_TEMPLATE_SHEET_ID_DUPLICATE_CONTENT",
  });

  return {
    ...sheet,
    summary: opts.summary,
    rows: opts.rows,
  };
}

