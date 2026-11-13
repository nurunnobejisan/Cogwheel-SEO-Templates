import type { ZodType, ZodTypeDef } from "zod";
import { createTaskRun, updateTaskRun, type TaskRunFlag } from "@/core/runs";
import type { TaskStatus } from "@/tasks/tasks.config";

export interface ValidationOutcome<TDraft> {
  valid: boolean;
  flags: TaskRunFlag[];
  /** Optional sanitized/normalized draft returned by the validator. */
  normalized?: TDraft;
  /** Feedback lines passed back to Claude on retry. */
  feedback?: string[];
}

export interface PipelineConfig<TInput, TData, TDraft, TOutput> {
  taskId: string;
  propertyId?: string | null;
  schema: ZodType<TInput, ZodTypeDef, unknown>;
  rawInput: unknown;
  maxRetries?: number;
  fetchData: (input: TInput) => Promise<TData>;
  draftWithClaude: (ctx: {
    input: TInput;
    data: TData;
    attempt: number;
    feedback?: string[];
  }) => Promise<TDraft>;
  validate: (ctx: { input: TInput; data: TData; draft: TDraft }) => Promise<ValidationOutcome<TDraft>> | ValidationOutcome<TDraft>;
  renderTemplate: (ctx: {
    input: TInput;
    data: TData;
    draft: TDraft;
    flags: TaskRunFlag[];
  }) => Promise<{ outputUrl: string | null; output: TOutput }>;
}

export interface PipelineResult<TOutput> {
  runId: string;
  taskId: string;
  status: TaskStatus;
  outputUrl: string | null;
  flags: TaskRunFlag[];
  retries: number;
  output: TOutput;
}

/**
 * Shared execution pipeline for every SEO task:
 * Inputs -> Fetch data -> Claude draft -> Validate (auto-retry up to 2x, then flag) -> Fill template -> Return output link + Flag Summary
 */
export async function runTaskPipeline<TInput, TData, TDraft, TOutput>(
  cfg: PipelineConfig<TInput, TData, TDraft, TOutput>,
): Promise<PipelineResult<TOutput>> {
  const input = cfg.schema.parse(cfg.rawInput);
  const maxRetries = cfg.maxRetries ?? 2;

  const runRecord = await createTaskRun({
    propertyId: cfg.propertyId ?? null,
    taskId: cfg.taskId,
    inputs: (input ?? {}) as Record<string, unknown>,
  });

  try {
    const data = await cfg.fetchData(input);

    let attempt = 0;
    let feedback: string[] | undefined;
    let draft!: TDraft;
    let validation!: ValidationOutcome<TDraft>;

    while (true) {
      draft = await cfg.draftWithClaude({ input, data, attempt, feedback });
      validation = await cfg.validate({ input, data, draft });
      if (validation.normalized !== undefined) {
        draft = validation.normalized;
      }
      if (validation.valid || attempt >= maxRetries) {
        break;
      }
      attempt += 1;
      feedback =
        validation.feedback && validation.feedback.length > 0
          ? validation.feedback
          : validation.flags.map((f) => f.message);
    }

    const flags = validation.flags;
    const { outputUrl, output } = await cfg.renderTemplate({ input, data, draft, flags });

    const finalStatus: TaskStatus =
      !validation.valid || flags.some((f) => f.severity === "error") ? "Flagged" : "Done";

    await updateTaskRun(runRecord.id, {
      status: finalStatus,
      outputs: (output ?? {}) as Record<string, unknown>,
      flags,
      outputUrl,
    });

    return {
      runId: runRecord.id,
      taskId: cfg.taskId,
      status: finalStatus,
      outputUrl,
      flags,
      retries: attempt,
      output,
    };
  } catch (err) {
    const errFlag: TaskRunFlag = {
      code: "pipeline-error",
      message: (err as Error).message,
      severity: "error",
    };
    await updateTaskRun(runRecord.id, {
      status: "Flagged",
      flags: [errFlag],
      outputUrl: null,
    });
    throw err;
  }
}
