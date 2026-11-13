import { CRAWLER_USER_AGENT } from "./robots";
import type { RedirectHop } from "./types";

const MAX_REDIRECTS = 10;
const PAGE_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

export class RateLimiter {
  private nextAvailableAt = 0;
  private readonly minIntervalMs: number;

  constructor(maxRequestsPerSecond = 2) {
    this.minIntervalMs = Math.ceil(1000 / Math.max(1, maxRequestsPerSecond));
  }

  async wait(): Promise<void> {
    const now = Date.now();
    const delay = Math.max(0, this.nextAvailableAt - now);
    this.nextAvailableAt = Math.max(now, this.nextAvailableAt) + this.minIntervalMs;
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export interface FetchPageResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  redirectChain: RedirectHop[];
  html: string;
  responseTimeMs: number;
  error?: string;
}

async function fetchSingleHop(url: string, timeoutMs: number): Promise<Response> {
  return fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: {
      "User-Agent": CRAWLER_USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/**
 * Fetches a page with manual redirect tracking, 10s timeout, up to 2 retries on
 * network/5xx failures, and rate limiting (max 2 requests/sec).
 */
export async function fetchPageWithRedirects(
  startUrl: string,
  limiter: RateLimiter,
  timeoutMs = PAGE_TIMEOUT_MS,
): Promise<FetchPageResult> {
  let attempt = 0;
  let lastError = "";

  while (attempt <= MAX_RETRIES) {
    const started = Date.now();
    const redirectChain: RedirectHop[] = [];
    let currentUrl = startUrl;
    let statusCode = 0;
    let html = "";

    try {
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        await limiter.wait();
        const res = await fetchSingleHop(currentUrl, timeoutMs);
        statusCode = res.status;

        if (statusCode >= 300 && statusCode < 400) {
          const location = res.headers.get("location");
          if (!location) break;
          redirectChain.push({ url: currentUrl, statusCode });
          currentUrl = new URL(location, currentUrl).toString();
          continue;
        }

        const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
        if (!contentType || contentType.includes("text/html") || contentType.includes("application/xhtml")) {
          html = (await res.text()).slice(0, 1_500_000);
        }
        break;
      }

      if (statusCode >= 500 && attempt < MAX_RETRIES) {
        attempt += 1;
        continue;
      }

      return {
        url: startUrl,
        finalUrl: currentUrl,
        statusCode,
        redirectChain,
        html,
        responseTimeMs: Date.now() - started,
      };
    } catch (err) {
      lastError = (err as Error).message;
      if (attempt >= MAX_RETRIES) {
        return {
          url: startUrl,
          finalUrl: currentUrl,
          statusCode: 0,
          redirectChain,
          html: "",
          responseTimeMs: Date.now() - started,
          error: lastError,
        };
      }
      attempt += 1;
    }
  }

  return {
    url: startUrl,
    finalUrl: startUrl,
    statusCode: 0,
    redirectChain: [],
    html: "",
    responseTimeMs: 0,
    error: lastError || "Fetch failed",
  };
}
