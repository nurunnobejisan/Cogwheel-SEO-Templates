/**
 * AI SEO Brain — Fix Patch Orchestrator (Phase 2)
 *
 * Turns a standardized AuditReport into a validated FixPatch:
 *
 *   AuditReport ─▶ route task tier ─▶ RAG retrieve ─▶ prompt ─▶ model
 *                                                              │
 *                          deterministic synthesizer ◀────────┘ (fallback)
 *                                     │
 *                                     ▼
 *                          strict JSON patch validation
 *
 * The model path (ModelInvoker) is optional: when no provider is configured the
 * deterministic synthesizer runs alone, so the pipeline is always productive.
 */

import type { AuditIssue, AuditReport } from "../rules/types.ts";
import type {
  BuiltPrompt,
  DeferredIssue,
  FixPatch,
  FixPatchOptions,
  FixPatchResult,
  KnowledgeBase,
  PatchMutation,
  RouteDecision,
  TaskKind,
} from "./types.ts";
import { routeTask } from "./router.ts";
import { buildPatchPrompt, buildRagQuery, classifyIssueTask } from "./prompt.ts";
import { synthesizeMutation } from "./patch/synthesizer.ts";
import { isAutoApplyEligible, validateMutation, validateFixPatch } from "./patch/validator.ts";
import { createRagPipeline } from "./rag/index.ts";

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function generatePatchId(report: Pick<AuditReport, "auditId">, now: string): string {
  return `ptch_${hashString(`${report.auditId}|${now}`)}`;
}

/** Extract the `pageContext` facts the synthesizer/prompt can ground on. */
function defaultPageContext(report: AuditReport): Record<string, string | number | null> {
  const h1 = report.issues.find((issue) => issue.issueId === "iss_h1_missing")?.context.currentValue;
  return {
    domain: report.domain,
    url: report.pageUrl,
    mode: report.mode,
    h1: typeof h1 === "string" ? h1 : null,
  };
}

async function resolveViaModel(
  issue: AuditIssue,
  report: AuditReport,
  options: FixPatchOptions,
  knowledgeBase: KnowledgeBase,
  pageContext: Record<string, string | number | null>
): Promise<PatchMutation | null> {
  if (!options.invoker) {
    return null;
  }

  const task: TaskKind = classifyIssueTask(issue);
  const route: RouteDecision = routeTask(task, options.providers);
  const question = buildRagQuery(issue, report);
  let retrieved = await knowledgeBase.searchAsync(question, {
    topK: 4,
    tags: [issue.category],
  });
  if (retrieved.length === 0) {
    retrieved = await knowledgeBase.searchAsync(question, { topK: 4 });
  }
  const prompt: BuiltPrompt = buildPatchPrompt({
    issue,
    report,
    retrieved,
    tier: route.tier,
    task,
    pageContext,
  });

  const raw = await options.invoker.invoke(prompt);
  const parsed = parseMutationResponse(raw);
  if (!parsed) {
    return null;
  }
  const errors = validateMutation(parsed);
  if (errors.length > 0) {
    return null;
  }
  return parsed;
}

function parseMutationResponse(raw: string): PatchMutation | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") || trimmed.endsWith("```")) {
    return null;
  }
  try {
    const data = JSON.parse(trimmed) as Record<string, unknown>;
    const action = data.action;
    if (typeof data.field !== "string" || typeof action !== "string") {
      return null;
    }
    return {
      field: data.field,
      action: action as PatchMutation["action"],
      before: (data.before ?? null) as PatchMutation["before"],
      after: (data.after ?? null) as PatchMutation["after"],
      risk: (data.risk ?? "high") as PatchMutation["risk"],
      autoApply: Boolean(data.autoApply),
    };
  } catch {
    return null;
  }
}

/**
 * Generate a validated fix patch for every fixable issue in an audit report.
 */
export async function generateFixPatch(
  report: AuditReport,
  options: FixPatchOptions = {}
): Promise<FixPatchResult> {
  const now = options.now ?? new Date().toISOString();
  const knowledgeBase =
    options.knowledgeBase ?? createRagPipeline({ dimensions: options.embedder?.dimensions }).knowledgeBase;
  const pageContext = defaultPageContext(report);
  const routeSummary: Partial<Record<TaskKind, RouteDecision>> = {};

  const mutations: PatchMutation[] = [];
  const deferred: DeferredIssue[] = [];

  for (const issue of report.issues) {
    if (!issue.fixable) {
      deferred.push({ issue, reason: "Issue is marked non-fixable by the rule engine." });
      continue;
    }

    const task = classifyIssueTask(issue);
    if (!routeSummary[task]) {
      routeSummary[task] = routeTask(task, options.providers);
    }

    let mutation: PatchMutation | null = null;
    try {
      mutation = await resolveViaModel(issue, report, options, knowledgeBase, pageContext);
    } catch (error) {
      deferred.push({
        issue,
        reason: `Model path failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    if (!mutation) {
      mutation = synthesizeMutation({
        issue,
        report,
        pageContext: {
          h1: typeof pageContext.h1 === "string" ? pageContext.h1 : undefined,
        },
      });
    }

    if (!mutation) {
      deferred.push({ issue, reason: "No deterministic generator produced a mutation." });
      continue;
    }

    const errors = validateMutation(mutation);
    if (errors.length > 0) {
      deferred.push({ issue, reason: errors.join("; ") });
      continue;
    }

    mutation = { ...mutation, autoApply: isAutoApplyEligible(mutation, options.autoPilot ?? false) };
    mutations.push(mutation);
  }

  const patch: FixPatch = {
    patchId: options.patchId ?? generatePatchId(report, now),
    auditId: report.auditId,
    targetUrl: report.pageUrl,
    mode: report.mode,
    createdAt: now,
    mutations,
  };

  const validation = validateFixPatch(patch, { report });

  return {
    patch: validation.patch ?? patch,
    validation,
    deferred,
    routeSummary,
  };
}

export { synthesizeMutation } from "./patch/synthesizer.ts";
