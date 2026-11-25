export interface ScrollOptions {
  stepPx?: number;
  intervalMs?: number;
  maxDurationMs?: number;
  stabilizeMs?: number;
}

/**
 * Scrolls the page in incremental steps to trigger lazy‑loaded content, then returns to the top.
 *
 * @param options   Configuration for step size, timing and duration.
 * @param signal    Optional AbortSignal to cancel the scroll early.
 */
export async function controlledAutoScroll(
  options: ScrollOptions = {},
  signal?: AbortSignal
): Promise<void> {
  const {
    stepPx = 350,
    intervalMs = 90,
    maxDurationMs = 12_000,
    stabilizeMs = 500,
  } = options;

  const startTime = Date.now();

  await new Promise<void>((resolve) => {
    let scrolledHeight = 0;

    const timer = window.setInterval(() => {
      if (signal?.aborted || Date.now() - startTime >= maxDurationMs) {
        clearInterval(timer);
        // Reset to top instantly before finishing
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        resolve();
        return;
      }

      const maxScroll = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );

      window.scrollBy(0, stepPx);
      scrolledHeight += stepPx;

      // Stop if we have reached the bottom of the page
      if (
        scrolledHeight >= maxScroll ||
        window.innerHeight + window.scrollY >= maxScroll
      ) {
        clearInterval(timer);
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        resolve();
      }
    }, intervalMs);
  });

  // Give the page a moment to settle after scrolling completes
  await new Promise((r) => setTimeout(r, stabilizeMs));
}
