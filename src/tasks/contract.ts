import type { PipelineResult } from "@/core/pipeline";
import type { TaskRunFlag } from "@/core/runs";
import type { TaskConfig, TaskStatus } from "./tasks.config";

/**
 * Every task module in `src/tasks/<task-id>/` must provide these files,
 * plus at least one `*.test.ts` file.
 */
export const REQUIRED_MODULE_FILES = [
  "schema.ts",
  "prompt.ts",
  "validator.ts",
  "render.ts",
  "index.ts",
] as const;

export type RequiredModuleFile = (typeof REQUIRED_MODULE_FILES)[number];

/**
 * Statuses in `TASKS_CONFIG` that indicate a module is implemented and must
 * satisfy the full file & runner contract.
 */
export const IMPLEMENTED_TASK_STATUSES: ReadonlySet<string> = new Set<TaskStatus | "Built">([
  "Done",
  "Built",
]);

/**
 * Default 24-hour TTL (in milliseconds) for external API response caches.
 */
export const DEFAULT_EXTERNAL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface ExternalCacheEntry<T> {
  key: string;
  data: T;
  fetchedAt: string;
  expiresAt: string;
}

export interface TaskFlagSummary {
  totalFlags: number;
  hasErrors: boolean;
  hasWarnings: boolean;
  items: TaskRunFlag[];
}

export function summarizeTaskFlags(flags: TaskRunFlag[]): TaskFlagSummary {
  return {
    totalFlags: flags.length,
    hasErrors: flags.some((flag) => flag.severity === "error"),
    hasWarnings: flags.some((flag) => flag.severity === "warning"),
    items: flags,
  };
}

/**
 * Thrown when a required upstream task run is missing for a property.
 */
export class MissingDependencyError extends Error {
  readonly taskId: string;
  readonly missingDependencyId: string;

  constructor(taskId: string, missingDependencyId: string, detail?: string) {
    const base = `Task "${taskId}" requires "${missingDependencyId}" to be run first.`;
    super(detail ? `${base} ${detail}` : base);
    this.name = "MissingDependencyError";
    this.taskId = taskId;
    this.missingDependencyId = missingDependencyId;
  }
}

/**
 * Standard contract implemented by every task module runner.
 */
export interface TaskModuleContract<TInput = unknown, TOutput = unknown> {
  config: TaskConfig;
  run: (input: TInput) => Promise<PipelineResult<TOutput>>;
}

