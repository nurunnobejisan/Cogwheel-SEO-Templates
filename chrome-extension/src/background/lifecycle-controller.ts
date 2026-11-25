export type LifecycleState = "IDLE" | "CRAWLING" | "ANALYZING" | "COMPLETED";

export interface TabExecutionRecord {
  tabId: number;
  url: string;
  state: LifecycleState;
  runId: string;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  cancelled: boolean;
  error?: string;
}

/**
 * Autonomous Lifecycle Controller
 *
 * Manages per-tab execution state (IDLE -> CRAWLING -> ANALYZING -> COMPLETED)
 * and enforces execution locking so overlapping navigations or SPA transitions
 * never run concurrent audits on the same tab.
 */
export class AutonomousLifecycleController {
  private readonly records = new Map<number, TabExecutionRecord>();
  private readonly lockTimeoutMs: number;

  constructor(lockTimeoutMs = 20000) {
    this.lockTimeoutMs = lockTimeoutMs;
  }

  public getState(tabId: number): LifecycleState {
    return this.records.get(tabId)?.state ?? "IDLE";
  }

  public getRecord(tabId: number): TabExecutionRecord | undefined {
    return this.records.get(tabId);
  }

  public isLocked(tabId: number, now = Date.now()): boolean {
    const rec = this.records.get(tabId);
    if (!rec) return false;
    if (rec.state === "CRAWLING" || rec.state === "ANALYZING") {
      // Auto-expire stale locks past lockTimeoutMs
      if (now - rec.updatedAt > this.lockTimeoutMs) {
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Attempts to acquire an execution lock for a tab and enter CRAWLING state.
   * Returns null if an active, non-expired execution is already in progress.
   */
  public acquireLock(tabId: number, url: string, now = Date.now()): TabExecutionRecord | null {
    if (this.isLocked(tabId, now)) {
      return null;
    }

    const record: TabExecutionRecord = {
      tabId,
      url,
      state: "CRAWLING",
      runId: `run-${tabId}-${now}-${Math.random().toString(36).slice(2, 7)}`,
      startedAt: now,
      updatedAt: now,
      cancelled: false,
    };
    this.records.set(tabId, record);
    return record;
  }

  public transition(tabId: number, runId: string, nextState: LifecycleState, now = Date.now()): boolean {
    const rec = this.records.get(tabId);
    if (!rec || rec.runId !== runId || rec.cancelled) {
      return false;
    }
    rec.state = nextState;
    rec.updatedAt = now;
    if (nextState === "COMPLETED") {
      rec.completedAt = now;
    }
    return true;
  }

  public fail(tabId: number, runId: string, errorMessage: string, now = Date.now()): void {
    const rec = this.records.get(tabId);
    if (!rec || rec.runId !== runId) return;
    rec.state = "IDLE";
    rec.error = errorMessage;
    rec.updatedAt = now;
  }

  public cancel(tabId: number, now = Date.now()): void {
    const rec = this.records.get(tabId);
    if (!rec) return;
    rec.cancelled = true;
    rec.state = "IDLE";
    rec.updatedAt = now;
  }

  public reset(tabId: number): void {
    this.records.delete(tabId);
  }
}
