import type { TaskRunFlag } from "@/core/runs";
import type {
  BacklinkingStrategyExecutionDraft,
  BacklinkingStrategyExecutionInput,
} from "./schema";

export function validateBacklinkingExecutionDraft(
  draft: BacklinkingStrategyExecutionDraft,
  input: BacklinkingStrategyExecutionInput,
): { valid: boolean; flags: TaskRunFlag[]; feedback?: string[] } {
  const flags: TaskRunFlag[] = [];
  const feedback: string[] = [];

  if (!draft.roadmapPhases || draft.roadmapPhases.length === 0) {
    flags.push({
      code: "empty-roadmap-phases",
      message: "No execution roadmap phases were generated.",
      severity: "error",
    });
    feedback.push("You must provide at least 2 distinct sprint phases.");
  }

  if (!draft.outreachPipeline || draft.outreachPipeline.length === 0) {
    flags.push({
      code: "empty-outreach-pipeline",
      message: "No outreach targets were defined in the pipeline.",
      severity: "error",
    });
    feedback.push("Provide at least 3 initial target domain prospects in the outreach pipeline.");
  }

  const hostname = new URL(input.property.url).hostname;
  for (const item of draft.outreachPipeline ?? []) {
    try {
      const destHost = new URL(item.targetDestinationUrl).hostname;
      if (destHost !== hostname && !destHost.endsWith(`.${hostname}`)) {
        flags.push({
          code: "destination-url-mismatch",
          message: `Target destination URL "${item.targetDestinationUrl}" does not match property domain "${hostname}".`,
          severity: "warning",
        });
      }
    } catch {
      flags.push({
        code: "invalid-destination-url",
        message: `Destination URL "${item.targetDestinationUrl}" is invalid.`,
        severity: "error",
      });
      feedback.push(`Destination URL "${item.targetDestinationUrl}" must be a valid URL.`);
    }
  }

  return {
    valid: flags.filter((f) => f.severity === "error").length === 0,
    flags,
    feedback: feedback.length > 0 ? feedback : undefined,
  };
}
