import { createKeywordReportDoc, type RationaleEntry } from "@/core/google";
import { runDocumentQualityCheck, type DocumentQualityReport } from "@/lib/doc-quality";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { TemplateId } from "@/lib/types";
import type { ResolvedKeywordRun } from "./schema";

export interface KeywordResearchOutput {
  docId: string;
  docUrl: string;
  usedTemplateCopy: boolean;
  preservedTemplateDesign: boolean;
  usedAi: boolean;
  template: TemplateId;
  rationales: RationaleEntry[];
  qualityReport: DocumentQualityReport;
}

export async function renderKeywordResearchDoc(
  run: ResolvedKeywordRun,
  rationales: RationaleEntry[],
  usedAi: boolean,
): Promise<KeywordResearchOutput> {
  const doc = await createKeywordReportDoc({
    property: run.property,
    pages: run.pages,
    template: run.template,
    matrix: run.matrix,
    pool: run.pool,
    rationales,
  });

  const qualityReport = runDocumentQualityCheck({
    property: run.property,
    pages: run.pages,
    matrix: run.matrix,
    pool: run.pool,
    unresolvedPlaceholders: doc.unresolvedPlaceholders,
  });

  if (run.runId && isSupabaseConfigured()) {
    await getSupabase().from("runs").update({ status: "report_generated" }).eq("id", run.runId);
  }

  return {
    docId: doc.docId,
    docUrl: doc.docUrl,
    usedTemplateCopy: doc.usedTemplateCopy,
    preservedTemplateDesign: doc.preservedTemplateDesign ?? false,
    usedAi,
    template: run.template,
    rationales,
    qualityReport,
  };
}

