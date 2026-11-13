import type { RationaleEntry } from "@/core/google";
import type { ValidationOutcome } from "@/core/pipeline";
import type { TaskRunFlag } from "@/core/runs";
import { runDocumentQualityCheck, type DocumentQualityReport } from "@/lib/doc-quality";
import type { ResolvedKeywordRun } from "./schema";

export interface KeywordResearchDraft {
  rationales: RationaleEntry[];
  usedAi: boolean;
}

export function runPreGenerationChecks(run: ResolvedKeywordRun): {
  ok: boolean;
  error?: string;
  statusCode?: number;
  qualityReport?: DocumentQualityReport;
} {
  if (run.matrix.length === 0 || run.matrix.some((r) => r.status !== "approved")) {
    return {
      ok: false,
      error: "All active matrix rows must be approved before generating the Keyword Report.",
      statusCode: 400,
    };
  }

  const preCheck = runDocumentQualityCheck({
    property: run.property,
    pages: run.pages,
    matrix: run.matrix,
    pool: run.pool,
  });
  if (preCheck.overall === "failed") {
    return {
      ok: false,
      error: "Document quality check failed before generation.",
      statusCode: 400,
      qualityReport: preCheck,
    };
  }
  return { ok: true, qualityReport: preCheck };
}

export function validateKeywordResearchDraft(
  run: ResolvedKeywordRun,
  draft: KeywordResearchDraft,
): ValidationOutcome<KeywordResearchDraft> {
  const flags: TaskRunFlag[] = [];
  const feedback: string[] = [];

  for (const row of run.matrix) {
    const entry = draft.rationales.find((r) => r.pageId === row.pageId);
    if (!entry || !entry.text.trim()) {
      flags.push({
        code: "missing-rationale",
        message: `Missing rationale text for page ${row.title} (${row.pageId}).`,
        severity: "error",
        section: row.pageId,
      });
      feedback.push(`Provide non-empty rationale text for pageId "${row.pageId}".`);
    }
  }

  return {
    valid: flags.length === 0,
    flags,
    feedback: feedback.length > 0 ? feedback : undefined,
  };
}
