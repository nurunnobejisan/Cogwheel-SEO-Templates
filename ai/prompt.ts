/**
 * Prompt Construction Engine (Phase 2)
 *
 * Assembles the grounded prompt for a single fix: the strict JSON output
 * contract, the specific audit issue, and the retrieved knowledge-base context.
 * The instruction explicitly forbids freeform prose so the model cannot return
 * text that the validation layer would reject.
 */

import type { AuditIssue, AuditReport } from "../rules/types.ts";
import type { BuiltPrompt, ScoredChunk, TaskKind } from "./types.ts";

export const FIX_PATCH_SYSTEM_PROMPT = `You are the SEO Fix Engine.

You convert a single SEO audit issue into a machine-applicable JSON mutation.

HARD RULES:
1. Output ONE JSON object and nothing else. No markdown, no prose, no code fences.
2. Conform exactly to this shape:
   {
     "field": string,            // CMS target field, e.g. "meta_description"
     "action": "replace" | "inject" | "remove" | "manual_review",
     "before": string | object | null,
     "after": string | object | null,
     "risk": "low" | "medium" | "high"
   }
3. "replace"/"inject" require a non-empty "after". "manual_review" requires "after": null.
4. Never invent facts about the business. Use only the provided page context and knowledge.
5. Respect the SERP budgets: title 40-60 chars, meta description 120-160 chars.
6. Ground every change in the retrieved knowledge context; if the context does
   not cover the case, prefer "manual_review" over guessing.`;

/**
 * Map an issue to the task kind that determines its model tier.
 */
export function classifyIssueTask(issue: AuditIssue): TaskKind {
  switch (issue.category) {
    case "accessibility":
      return "alt_text_generation";
    case "schema":
    case "hospitality":
      return "schema_generation";
    case "metadata":
      return "metadata_generation";
    case "content":
      return "semantic_reasoning";
    case "media":
    case "technical":
    default:
      return "structured_extraction";
  }
}

/** Build the retrieval query used to pull grounding context for an issue. */
export function buildRagQuery(issue: AuditIssue, report?: Pick<AuditReport, "domain" | "mode">): string {
  const parts = [
    issue.issueId.replace(/^iss_/, "").replace(/_/g, " "),
    issue.category,
    issue.context.selector,
    issue.context.recommendedAction,
    issue.cmsTargetField ?? "",
  ];
  if (report?.mode === "hotel" || issue.category === "hospitality") {
    parts.push("hotel hospitality lodging");
  }
  return parts.join(" ").trim();
}

export interface BuildPromptInput {
  issue: AuditIssue;
  report: Pick<AuditReport, "auditId" | "domain" | "pageUrl" | "mode" | "timestamp">;
  retrieved: ScoredChunk[];
  tier: BuiltPrompt["tier"];
  task: TaskKind;
  /** Optional page facts (title, heading, existing value) to ground the fix. */
  pageContext?: Record<string, string | number | null>;
}

function renderContext(chunks: ScoredChunk[]): string {
  if (chunks.length === 0) {
    return "(no knowledge-base context matched)";
  }
  return chunks
    .map(
      (chunk, index) =>
        `[${index + 1}] ${chunk.title} — ${chunk.source}${chunk.url ? ` (${chunk.url})` : ""} [score ${chunk.score}]\n${chunk.text}`
    )
    .join("\n\n");
}

/**
 * Build the complete grounded prompt for a single issue fix.
 */
export function buildPatchPrompt(input: BuildPromptInput): BuiltPrompt {
  const { issue, report, retrieved, tier, task, pageContext } = input;

  const contextLines = Object.entries(pageContext ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `- ${key}: ${String(value)}`)
    .join("\n");

  const user = `PAGE
- url: ${report.pageUrl}
- domain: ${report.domain}
- mode: ${report.mode}

AUDIT ISSUE
- id: ${issue.issueId}
- category: ${issue.category}
- severity: ${issue.severity}
- fixable: ${issue.fixable}
- cmsTargetField: ${issue.cmsTargetField ?? "(none)"}
- selector: ${issue.context.selector}
- currentValue: ${JSON.stringify(issue.context.currentValue)}
- recommendedAction: ${issue.context.recommendedAction}
${contextLines ? `\nPAGE CONTEXT\n${contextLines}\n` : ""}
RETRIEVED KNOWLEDGE
${renderContext(retrieved)}

Return the single JSON mutation object now.`;

  return {
    system: FIX_PATCH_SYSTEM_PROMPT,
    user,
    tier,
    task,
    contextIds: retrieved.map((chunk) => chunk.id),
  };
}
