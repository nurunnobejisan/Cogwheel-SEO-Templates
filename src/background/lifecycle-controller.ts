export type AuditState = 'IDLE' | 'CRAWLING' | 'ANALYZING' | 'COMPLETED' | 'FAILED';

export interface TabExecutionContext {
  tabId: number;
  url: string;
  state: AuditState;
  startedAt: number;
  modeOverride?: 'hospitality' | 'universal';
}

export class LifecycleController {
  private static getKey(tabId: number): string {
    return `exec_lock_tab_${tabId}`;
  }

  static async acquireLock(tabId: number, url: string): Promise<boolean> {
    const key = this.getKey(tabId);
    const existing = await chrome.storage.session.get(key);
    const ctx: TabExecutionContext | undefined = existing[key];

    // Prevent overlapping runs unless stale (> 45 seconds)
    if (ctx && (ctx.state === 'CRAWLING' || ctx.state === 'ANALYZING')) {
      if (Date.now() - ctx.startedAt < 45_000) {
        return false;
      }
    }

    const nextCtx: TabExecutionContext = {
      tabId,
      url,
      state: 'CRAWLING',
      startedAt: Date.now(),
    };
    await chrome.storage.session.set({ [key]: nextCtx });
    return true;
  }

  static async transition(tabId: number, state: AuditState): Promise<void> {
    const key = this.getKey(tabId);
    const existing = await chrome.storage.session.get(key);
    if (!existing[key]) return;

    await chrome.storage.session.set({
      [key]: { ...existing[key], state },
    });
  }

  static async release(tabId: number): Promise<void> {
    await chrome.storage.session.remove(this.getKey(tabId));
  }
}
