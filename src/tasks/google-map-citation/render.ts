import type { TaskRunFlag } from "@/core/runs";
import type {
  GoogleMapCitationDraft,
  GoogleMapCitationInput,
} from "./schema";

export interface GoogleMapCitationOutput {
  property: GoogleMapCitationInput["property"];
  napConsistencyScore: number;
  gbpCategoryRecommendation: GoogleMapCitationDraft["gbpCategoryRecommendation"];
  citationDirectoryAudits: GoogleMapCitationDraft["citationDirectoryAudits"];
  napDiscrepancies: GoogleMapCitationDraft["napDiscrepancies"];
  immediateFixChecklist: string[];
  directoriesAuditedCount: number;
  auditedAt: string;
}

export function renderGoogleMapCitationOutput(opts: {
  input: GoogleMapCitationInput;
  draft: GoogleMapCitationDraft;
  flags: TaskRunFlag[];
}): { outputUrl: string | null; output: GoogleMapCitationOutput } {
  const output: GoogleMapCitationOutput = {
    property: opts.input.property,
    napConsistencyScore: opts.draft.napConsistencyScore,
    gbpCategoryRecommendation: opts.draft.gbpCategoryRecommendation,
    citationDirectoryAudits: opts.draft.citationDirectoryAudits ?? [],
    napDiscrepancies: opts.draft.napDiscrepancies ?? [],
    immediateFixChecklist: opts.draft.immediateFixChecklist ?? [],
    directoriesAuditedCount: opts.draft.citationDirectoryAudits?.length ?? 0,
    auditedAt: new Date().toISOString(),
  };

  return { outputUrl: null, output };
}
