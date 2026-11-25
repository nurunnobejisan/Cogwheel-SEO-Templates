export interface AutoscrollOptions {
  stepPx?: number;
  intervalMs?: number;
  maxDurationMs?: number;
  restoreScroll?: boolean;
}

export interface AutoscrollResult {
  completed: boolean;
  cancelled: boolean;
  stepsExecuted: number;
  elapsedMs: number;
  maxScrollY: number;
}

let activeCancelFlag = false;

export function cancelControlledAutoscroll(): void {
  activeCancelFlag = true;
}

/**
 * Scrolls the viewport from top to bottom at a controlled pace to trigger
 * lazy-loaded DOM elements and images, bounded by maxDurationMs and
 * cancellable on navigation.
 */
export async function runControlledAutoscroll(
  options: AutoscrollOptions = {}
): Promise<AutoscrollResult> {
  const stepPx = Math.max(200, options.stepPx ?? 600);
  const intervalMs = Math.max(30, options.intervalMs ?? 80);
  const maxDurationMs = Math.min(8000, Math.max(300, options.maxDurationMs ?? 2000));
  const restoreScroll = options.restoreScroll ?? true;

  activeCancelFlag = false;
  const startTime = Date.now();
  const initialY = typeof window !== "undefined" ? window.scrollY : 0;

  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      completed: true,
      cancelled: false,
      stepsExecuted: 0,
      elapsedMs: 0,
      maxScrollY: 0,
    };
  }

  const getScrollHeight = () =>
    Math.max(
      document.body?.scrollHeight || 0,
      document.documentElement?.scrollHeight || 0
    );

  let currentY = 0;
  let stepsExecuted = 0;
  let maxScrollY = initialY;

  window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });

  while (!activeCancelFlag) {
    const elapsed = Date.now() - startTime;
    if (elapsed >= maxDurationMs) {
      break;
    }

    const totalHeight = getScrollHeight();
    const viewportHeight = window.innerHeight || 800;
    if (currentY + viewportHeight >= totalHeight) {
      break;
    }

    currentY = Math.min(currentY + stepPx, totalHeight);
    window.scrollTo({ top: currentY, behavior: "instant" as ScrollBehavior });
    maxScrollY = Math.max(maxScrollY, currentY);
    stepsExecuted++;

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  const cancelled = activeCancelFlag;
  if (restoreScroll) {
    window.scrollTo({ top: initialY, behavior: "instant" as ScrollBehavior });
  }

  return {
    completed: !cancelled,
    cancelled,
    stepsExecuted,
    elapsedMs: Date.now() - startTime,
    maxScrollY,
  };
}
