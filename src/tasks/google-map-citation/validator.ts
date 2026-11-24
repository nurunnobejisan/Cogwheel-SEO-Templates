import type { TaskRunFlag } from "@/core/runs";
import type {
  GoogleMapCitationDraft,
  GoogleMapCitationInput,
} from "./schema";

export function validateGoogleMapCitationDraft(
  draft: GoogleMapCitationDraft,
  _input: GoogleMapCitationInput,
): { valid: boolean; flags: TaskRunFlag[]; feedback?: string[] } {
  const flags: TaskRunFlag[] = [];
  const feedback: string[] = [];

  if (draft.napConsistencyScore < 0 || draft.napConsistencyScore > 100) {
    flags.push({
      code: "invalid-nap-score",
      message: `NAP consistency score ${draft.napConsistencyScore} is out of bounds (0-100).`,
      severity: "error",
    });
    feedback.push("NAP consistency score must be an integer between 0 and 100.");
  }

  if (!draft.citationDirectoryAudits || draft.citationDirectoryAudits.length === 0) {
    flags.push({
      code: "empty-directory-audits",
      message: "No directory citations were evaluated.",
      severity: "error",
    });
    feedback.push("You must evaluate at least 3 major directory citations (e.g. Google Maps, TripAdvisor, Yelp).");
  }

  return {
    valid: flags.filter((f) => f.severity === "error").length === 0,
    flags,
    feedback: feedback.length > 0 ? feedback : undefined,
  };
}
