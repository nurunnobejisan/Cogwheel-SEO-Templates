import { renderTabularSheetOutput } from "@/core/sheet-export";
import type { Property } from "@/lib/types";
import type { TechnicalAuditRowDraft, TechnicalAuditSummary } from "./schema";

export interface TechnicalAuditOutput {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  usedTemplateCopy: boolean;
  xlsxBase64: string;
  summary: TechnicalAuditSummary;
  rows: TechnicalAuditRowDraft[];
}

const HEADERS = ["URL", "Category", "Severity", "Issue", "Recommendation", "Owner", "Impact"];

export async function renderTechnicalAuditOutput(opts: {
  property: Pick<Property, "name" | "brand" | "city" | "state" | "url">;
  summary: TechnicalAuditSummary;
  rows: TechnicalAuditRowDraft[];
}): Promise<TechnicalAuditOutput> {
  const sheet = await renderTabularSheetOutput({
    title: `${opts.property.name} — Technical SEO Audit`,
    sheetName: "Technical Audit",
    headers: HEADERS,
    rows: opts.rows.map((r) => [
      r.url,
      r.category,
      r.severity,
      r.issue,
      r.recommendation,
      r.owner,
      r.impact,
    ]),
    templateEnvKey: "GOOGLE_TEMPLATE_SHEET_ID_TECH_AUDIT",
  });

  return {
    ...sheet,
    summary: opts.summary,
    rows: opts.rows,
  };
}

