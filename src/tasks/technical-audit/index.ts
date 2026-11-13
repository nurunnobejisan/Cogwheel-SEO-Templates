import { generateClaudeText, isClaudeConfigured } from "@/core/claude";
import { getCrawlPages } from "@/core/crawler";
import { runTaskPipeline, type PipelineResult } from "@/core/pipeline";
import type { TaskRunFlag } from "@/core/runs";
import { resolvePropertyAndCrawl, type PropertySummary } from "@/tasks/_shared/crawl-context";
import { TaskExecutionError } from "@/tasks/keyword-research";
import {
  buildTechnicalAuditPrompt,
  detectDeterministicTechnicalFindings,
  parseTechnicalAuditDraft,
} from "./prompt";
import { renderTechnicalAuditOutput, type TechnicalAuditOutput } from "./render";
import {
  technicalAuditInputSchema,
  type TechnicalAuditInput,
  type TechnicalAuditRowDraft,
  type TechnicalAuditSummary,
  type TechnicalFinding,
} from "./schema";
import { validateTechnicalAuditRows } from "./validator";

interface TechnicalAuditDataBundle {
  property: PropertySummary;
  findings: TechnicalFinding[];
  summary: TechnicalAuditSummary;
  allowedUrls: Set<string>;
  initialFlags: TaskRunFlag[];
}

export interface TechnicalAuditDeps {
  callClaude?: (opts: { system: string; prompt: string; maxTokens?: number; taskId?: string }) => Promise<string>;
}

export async function runTechnicalAuditTask(
  rawInput: unknown,
  deps: TechnicalAuditDeps = {},
): Promise<PipelineResult<TechnicalAuditOutput>> {
  const parsed = technicalAuditInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new TaskExecutionError("Invalid request", 400, { issues: parsed.error.issues });
  }

  const input = parsed.data;
  if (!deps.callClaude && !isClaudeConfigured()) {
    throw new TaskExecutionError("ANTHROPIC_API_KEY is not configured.", 503);
  }

  const { propertyId, property, crawlRun } = await resolvePropertyAndCrawl({
    propertyId: input.propertyId,
    property: input.property,
    crawlRunId: input.crawlRunId,
  });

  const callClaude = deps.callClaude ?? generateClaudeText;

  return runTaskPipeline<
    TechnicalAuditInput,
    TechnicalAuditDataBundle,
    TechnicalAuditRowDraft[],
    TechnicalAuditOutput
  >({
    taskId: "technical-audit",
    propertyId,
    schema: technicalAuditInputSchema,
    rawInput: input,
    maxRetries: 2,
    fetchData: async () => {
      const rawPages = await getCrawlPages(crawlRun.id);
      const filtered =
        input.pageUrls && input.pageUrls.length > 0
          ? rawPages.filter((p) => input.pageUrls!.includes(p.url))
          : rawPages;

      if (filtered.length === 0) {
        throw new TaskExecutionError("Site Crawl has no pages matching the selection.", 400);
      }

      const { findings, summary } = detectDeterministicTechnicalFindings(crawlRun, filtered);
      const allowedUrls = new Set(filtered.map((p) => p.url));
      const initialFlags: TaskRunFlag[] = [];

      if (findings.length === 0) {
        initialFlags.push({
          code: "clean-technical-crawl",
          message: "No technical SEO issues detected across crawled pages.",
          severity: "warning",
        });
      }

      return { property, findings, summary, allowedUrls, initialFlags };
    },
    draftWithClaude: async ({ data, feedback }) => {
      if (data.findings.length === 0) {
        return [];
      }
      const { system, prompt } = buildTechnicalAuditPrompt({
        property: data.property,
        findings: data.findings,
        summary: data.summary,
        feedback,
      });
      const text = await callClaude({ system, prompt, maxTokens: 4096, taskId: "technical-audit" });
      return parseTechnicalAuditDraft(text);
    },
    validate: ({ data, draft }) => {
      const outcome = validateTechnicalAuditRows({
        draft,
        findings: data.findings,
        allowedUrls: data.allowedUrls,
      });
      return {
        ...outcome,
        flags: [...data.initialFlags, ...outcome.flags],
      };
    },
    renderTemplate: async ({ data, draft }) => {
      const output = await renderTechnicalAuditOutput({
        property: data.property,
        summary: data.summary,
        rows: draft,
      });
      return { outputUrl: output.spreadsheetUrl, output };
    },
  });
}
