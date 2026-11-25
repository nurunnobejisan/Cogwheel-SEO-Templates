/**
 * Scan Worker (Phase 5)
 *
 * Drains due jobs from the Phase 4 `ScanScheduler` and runs the self-healing
 * pipeline for each, one target at a time. This is the process a queue worker
 * (BullMQ / Cloud Scheduler) or the Next.js cron route drives in production.
 *
 *   scheduler.takeDue() ─▶ serial queue ─▶ healing pipeline ─▶ result/backoff
 */

import type { AuditReport } from "../rules/types.ts";
import type { CmsConnector } from "../cms/types.ts";
import type { ApprovalQueue } from "../healing/approval.ts";
import type { HealingEventBus } from "../healing/events.ts";
import { runHealingPipeline } from "../healing/pipeline.ts";
import type { RollbackStore } from "../healing/rollback-store.ts";
import type { ScanScheduler } from "../healing/scheduler.ts";
import type { AutoPilotPolicy, HealingRunResult, ScanJob } from "../healing/types.ts";
import type { PatchStore } from "./patch-store.ts";
import {
  createSerialQueue,
  withRetry,
  type RetryOptions,
  type SerialQueue,
} from "./rate-limit.ts";

export interface HealingRunnerDependencies {
  resolveConnector: (targetUrl: string) => CmsConnector | null;
  /** Fetch + audit the target. Injected so tests (and the crawler) plug in. */
  resolveReport: (targetUrl: string) => Promise<AuditReport> | AuditReport;
  policy?: AutoPilotPolicy;
  events?: HealingEventBus;
  approvals?: ApprovalQueue;
  rollbackStore?: RollbackStore;
  patches?: PatchStore;
  now?: () => string;
}

export class NoConnectorError extends Error {
  constructor(targetUrl: string) {
    super(`no connector registered for ${targetUrl}`);
    this.name = "NoConnectorError";
  }
}

/** Compose a job→HealingRunResult runner from the platform dependencies. */
export function createHealingRunner(
  deps: HealingRunnerDependencies
): (job: ScanJob) => Promise<HealingRunResult> {
  return async (job) => {
    const connector = deps.resolveConnector(job.targetUrl);
    if (!connector) {
      throw new NoConnectorError(job.targetUrl);
    }
    const report = await deps.resolveReport(job.targetUrl);
    return runHealingPipeline({
      report,
      connector,
      policy: deps.policy,
      events: deps.events,
      queue: deps.approvals,
      rollbackStore: deps.rollbackStore,
      onPatch: deps.patches ? (patch) => void deps.patches!.put(patch) : undefined,
      now: deps.now,
    });
  };
}

export interface WorkerRunRecord {
  job: ScanJob;
  result: HealingRunResult;
}

export interface WorkerFailure {
  job: ScanJob;
  message: string;
}

export interface WorkerTickSummary {
  jobs: number;
  results: WorkerRunRecord[];
  failures: WorkerFailure[];
}

export interface ScanWorkerOptions {
  scheduler: ScanScheduler;
  runner: (job: ScanJob) => Promise<HealingRunResult>;
  intervalMs?: number;
  serialQueue?: SerialQueue;
  retry?: RetryOptions;
  now?: () => Date;
  onResult?: (record: WorkerRunRecord) => void;
  onError?: (failure: WorkerFailure) => void;
}

export interface ScanWorker {
  tick(at?: Date): Promise<WorkerTickSummary>;
  start(): void;
  stop(): void;
  running(): boolean;
  /** Total jobs processed by this worker across all ticks. */
  processed(): number;
}

export function createScanWorker(options: ScanWorkerOptions): ScanWorker {
  const intervalMs = options.intervalMs ?? 60_000;
  const queue = options.serialQueue ?? createSerialQueue();
  const nowOf = options.now ?? (() => new Date());
  const retry = {
    maxAttempts: 3,
    baseDelayMs: 500,
    ...options.retry,
    isRetryable:
      options.retry?.isRetryable ??
      ((error: unknown) => !(error instanceof NoConnectorError)),
  } satisfies RetryOptions;

  let timer: ReturnType<typeof setInterval> | null = null;
  let total = 0;

  async function tick(at: Date = nowOf()): Promise<WorkerTickSummary> {
    const jobs = options.scheduler.takeDue(at);
    const results: WorkerRunRecord[] = [];
    const failures: WorkerFailure[] = [];

    for (const job of jobs) {
      try {
        const result = await queue.run(job.targetUrl, () => withRetry(() => options.runner(job), retry));
        total += 1;
        const record: WorkerRunRecord = { job, result };
        results.push(record);
        options.onResult?.(record);
      } catch (error) {
        const failure: WorkerFailure = {
          job,
          message: error instanceof Error ? error.message : String(error),
        };
        failures.push(failure);
        options.onError?.(failure);
      }
    }

    return { jobs: jobs.length, results, failures };
  }

  return {
    tick,
    start() {
      if (timer) {
        return;
      }
      timer = setInterval(() => {
        void tick().catch(() => undefined);
      }, intervalMs);
      // Do not keep the Node process alive just for the poller.
      if (typeof timer === "object" && timer && "unref" in timer) {
        (timer as { unref: () => void }).unref();
      }
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    running() {
      return timer !== null;
    },
    processed() {
      return total;
    },
  };
}