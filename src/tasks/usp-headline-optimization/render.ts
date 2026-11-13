import { keywordForSection, SECTION_RULES } from "@/config/hilton-rules";
import { createHiltonContentDoc, isGoogleConfigured } from "@/core/google";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { SectionValidationResult } from "@/lib/hilton-validator";
import { HILTON_SECTION_IDS, type UspHeadlineInput } from "./schema";
import type { GeneratedSectionsDraft } from "./validator";

export interface UspHeadlineOutput {
  sections: Record<string, string>;
  validation: Record<string, SectionValidationResult>;
  retries: Record<string, number>;
  docId: string | null;
  docUrl: string | null;
  usedTemplateCopy: boolean;
  strippedInstructionsCount: number;
  googleWarning: string | null;
}

export async function renderUspHeadlineDoc(
  input: UspHeadlineInput,
  draft: GeneratedSectionsDraft,
): Promise<UspHeadlineOutput> {
  let docId: string | null = null;
  let docUrl: string | null = null;
  let usedTemplateCopy = false;
  let strippedInstructionsCount = 0;
  let googleWarning: string | null = null;

  if (input.generateDoc) {
    if (!isGoogleConfigured()) {
      googleWarning = "Google Workspace credentials are not configured (GOOGLE_SERVICE_ACCOUNT_B64); skipped Doc creation.";
    } else {
      try {
        const doc = await createHiltonContentDoc({
          property: input.property,
          sections: HILTON_SECTION_IDS.map((id) => ({
            id,
            label: SECTION_RULES[id].label,
            keyword: keywordForSection(id, input.matrix) || undefined,
            content: draft.sections[id],
          })),
        });
        docId = doc.docId;
        docUrl = doc.docUrl;
        usedTemplateCopy = doc.usedTemplateCopy;
        strippedInstructionsCount = doc.strippedInstructionsCount;
      } catch (e) {
        googleWarning = `Google Doc creation failed (copy was still generated below): ${(e as Error).message}`;
      }
    }
  }

  if (input.runId && isSupabaseConfigured()) {
    await getSupabase().from("runs").update({ status: "copy_generated" }).eq("id", input.runId);
  }

  return {
    sections: draft.sections,
    validation: draft.validation,
    retries: draft.retries,
    docId,
    docUrl,
    usedTemplateCopy,
    strippedInstructionsCount,
    googleWarning,
  };
}
