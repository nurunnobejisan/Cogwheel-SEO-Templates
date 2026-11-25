/**
 * Continuous / Scheduled Scan Scheduler (Phase 4, step 1)
 *
 * Audits can be triggered manually (extension UI), by CMS webhooks (a page was
 * published/updated), or on a cron schedule. This module owns the schedules and
 * a small job queue; a worker drains due jobs and calls the healing pipeline.
 *
 * A compact 5-field cron matcher is included so the scheduler has no external
 * dependency.
 */

import type { ScanJob, ScanSchedule, ScanTrigger } from "./types.ts";

/** Match one cron field against a value. Supports `*`, lists, ranges, steps. */
export function cronFieldMatches(field: string, min: number, max: number, value: number): boolean {
  if (field === "*" || field === "?") {
    return true;
  }
  return field.split(",").some((part) => {
    const [range, stepRaw] = part.split("/");
    const step = stepRaw ? Number(stepRaw) : 1;
    if (!Number.isFinite(step) || step <= 0) {
      return false;
    }
    let start = min;
    let end = max;
    if (range !== undefined && range !== "*") {
      if (range.includes("-")) {
        const [a, b] = range.split("-").map(Number);
        if (!Number.isFinite(a) || !Number.isFinite(b)) {
          return false;
        }
        start = a!;
        end = b!;
      } else {
        const single = Number(range);
        if (!Number.isFinite(single)) {
          return false;
        }
        start = single;
        end = single;
      }
    }
    if (value < start || value > end) {
      return false;
    }
    return (value - start) % step === 0;
  });
}

/** Standard 5-field cron match (minute hour day-of-month month day-of-week). */
export function matchesCron(expression: string, date: Date): boolean {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`cron expression must have 5 fields, received "${expression}"`);
  }
  const [minute, hour, dom, month, dow] = parts as [string, string, string, string, string];

  if (!cronFieldMatches(minute, 0, 59, date.getMinutes())) return false;
  if (!cronFieldMatches(hour, 0, 23, date.getHours())) return false;
  if (!cronFieldMatches(month, 1, 12, date.getMonth() + 1)) return false;

  const domRestricted = dom !== "*";
  const dowRestricted = dow !== "*";
  const domOk = cronFieldMatches(dom, 1, 31, date.getDate());
  const dowOk = cronFieldMatches(dow.replace(/\b7\b/g, "0"), 0, 6, date.getDay());
  if (domRestricted && dowRestricted) {
    return domOk || dowOk;
  }
  return domOk && dowOk;
}

export interface ScanScheduler {
  register(input: { targetUrl: string; cron: string; enabled?: boolean; id?: string }): ScanSchedule;
  list(): ScanSchedule[];
  setEnabled(id: string, enabled: boolean): ScanSchedule | null;
  /** Materialize jobs for every schedule matching `now`, then return all queued jobs. */
  takeDue(now?: Date): ScanJob[];
  onCmsPublish(input: { targetUrl: string; now?: Date }): ScanJob;
  manual(targetUrl: string, now?: Date): ScanJob;
  queued(): ScanJob[];
  drain(): ScanJob[];
}

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

export function createScanScheduler(): ScanScheduler {
  const schedules = new Map<string, ScanSchedule>();
  const queue: ScanJob[] = [];

  function makeJob(targetUrl: string, trigger: ScanTrigger, scheduleId: string | null, at: Date): ScanJob {
    const job: ScanJob = {
      id: nextId("job"),
      scheduleId,
      targetUrl,
      trigger,
      dueAt: at.toISOString(),
    };
    queue.push(job);
    return job;
  }

  return {
    register({ targetUrl, cron, enabled = true, id }) {
      // Validate the expression eagerly so bad schedules fail fast.
      matchesCron(cron, new Date());
      const schedule: ScanSchedule = { id: id ?? nextId("sch"), targetUrl, cron, enabled };
      schedules.set(schedule.id, schedule);
      return schedule;
    },

    list() {
      return [...schedules.values()];
    },

    setEnabled(id, enabled) {
      const schedule = schedules.get(id);
      if (!schedule) {
        return null;
      }
      const updated = { ...schedule, enabled };
      schedules.set(id, updated);
      return updated;
    },

    takeDue(now = new Date()) {
      for (const schedule of schedules.values()) {
        if (!schedule.enabled || !matchesCron(schedule.cron, now)) {
          continue;
        }
        const ranThisMinute =
          schedule.lastRunAt !== undefined &&
          Math.floor(new Date(schedule.lastRunAt).getTime() / 60000) === Math.floor(now.getTime() / 60000);
        if (ranThisMinute) {
          continue;
        }
        schedule.lastRunAt = now.toISOString();
        makeJob(schedule.targetUrl, "cron", schedule.id, now);
      }
      return [...queue];
    },

    onCmsPublish({ targetUrl, now = new Date() }) {
      return makeJob(targetUrl, "webhook", null, now);
    },

    manual(targetUrl, now = new Date()) {
      return makeJob(targetUrl, "manual", null, now);
    },

    queued() {
      return [...queue];
    },

    drain() {
      return queue.splice(0, queue.length);
    },
  };
}
