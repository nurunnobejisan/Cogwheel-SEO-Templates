import type { TaskRunFlag } from "@/core/runs";
import type {
  SitemapNavigationOptimizationDraft,
  SitemapNavigationOptimizationInput,
} from "./schema";

export function validateSitemapNavigationDraft(
  draft: SitemapNavigationOptimizationDraft,
  input: SitemapNavigationOptimizationInput,
): { valid: boolean; flags: TaskRunFlag[]; feedback?: string[] } {
  const flags: TaskRunFlag[] = [];
  const feedback: string[] = [];

  if (!draft.generatedXmlSitemapEntries || draft.generatedXmlSitemapEntries.length === 0) {
    flags.push({
      code: "empty-generated-sitemap",
      message: "No XML sitemap entries were generated.",
      severity: "error",
    });
    feedback.push("You must generate at least 1 valid XML sitemap entry for the homepage.");
  }

  const hostname = new URL(input.property.url).hostname;
  for (const entry of draft.generatedXmlSitemapEntries ?? []) {
    try {
      const entryHost = new URL(entry.loc).hostname;
      if (entryHost !== hostname && !entryHost.endsWith(`.${hostname}`)) {
        flags.push({
          code: "cross-domain-sitemap-url",
          message: `Sitemap entry "${entry.loc}" has cross-domain host "${entryHost}".`,
          severity: "warning",
        });
      }
    } catch {
      flags.push({
        code: "invalid-sitemap-url",
        message: `Sitemap entry "${entry.loc}" is not a valid absolute URL.`,
        severity: "error",
      });
      feedback.push(`Sitemap location "${entry.loc}" must be an absolute URL.`);
    }

    if (entry.priority < 0 || entry.priority > 1.0) {
      flags.push({
        code: "invalid-priority",
        message: `Sitemap entry "${entry.loc}" has out-of-bounds priority ${entry.priority}.`,
        severity: "error",
      });
      feedback.push(`Priority for "${entry.loc}" must be between 0.0 and 1.0.`);
    }
  }

  return {
    valid: flags.filter((f) => f.severity === "error").length === 0,
    flags,
    feedback: feedback.length > 0 ? feedback : undefined,
  };
}
