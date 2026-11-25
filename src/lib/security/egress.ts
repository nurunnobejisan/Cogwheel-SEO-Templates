/**
 * Outbound request (SSRF) protection.
 *
 * `validateTargetUrl()` performs the cheap syntactic checks (scheme, literal
 * IPs, internal hostnames). A hostname that *looks* public can still resolve to
 * loopback/private space — or a redirect can point at the cloud metadata
 * service. This module closes that gap:
 *
 *   - `assertEgressAllowed()` resolves the hostname and rejects the request if
 *     any address is private/reserved.
 *   - `safeFetch()` follows redirects manually and re-validates every hop, so
 *     an attacker-controlled `Location:` header cannot escape the allowlist.
 *
 * Node-only: import from route handlers / server code, never from a client
 * component.
 */

import dns from "node:dns/promises";
import { isPrivateOrReservedIp, UrlValidationError, validateTargetUrl } from "../../core/crawler/url";

export class EgressBlockedError extends UrlValidationError {
  constructor(message: string) {
    super(message);
    this.name = "EgressBlockedError";
  }
}

const MAX_REDIRECTS = 5;

/** Resolves `hostname` and throws when any returned address is non-public. */
async function assertHostResolvesToPublicIp(hostname: string): Promise<void> {
  // A literal IP was already checked by validateTargetUrl; skip DNS.
  if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) {
    return;
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new EgressBlockedError(`Could not resolve hostname: ${hostname}`);
  }

  if (addresses.length === 0) {
    throw new EgressBlockedError(`Could not resolve hostname: ${hostname}`);
  }

  for (const entry of addresses) {
    if (isPrivateOrReservedIp(entry.address)) {
      throw new EgressBlockedError(
        "That address resolves to a private or internal network and cannot be fetched.",
      );
    }
  }
}

/**
 * Validates a user-supplied URL for outbound fetching: scheme, hostname shape,
 * literal IP ranges, and DNS resolution of the hostname.
 *
 * Returns the normalized URL to fetch.
 */
export async function assertEgressAllowed(rawUrl: string): Promise<string> {
  const safeUrl = validateTargetUrl(rawUrl);
  if (!safeUrl) {
    throw new EgressBlockedError("A target URL is required.");
  }
  await assertHostResolvesToPublicIp(new URL(safeUrl).hostname);
  return safeUrl;
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxRedirects?: number;
}

/**
 * SSRF-safe `fetch`: validates the initial URL and every redirect hop, follows
 * redirects manually, and caps the hop count.
 *
 * Returns the final `Response` (body unread) plus the resolved URL.
 */
export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  options: SafeFetchOptions = {},
): Promise<{ response: Response; requestedUrl: string; finalUrl: string; redirects: string[] }> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;

  const requestedUrl = await assertEgressAllowed(rawUrl);
  let currentUrl = requestedUrl;
  const redirects: string[] = [];
  const signal = init.signal ?? AbortSignal.timeout(timeoutMs);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const response = await fetch(currentUrl, {
      ...init,
      redirect: "manual",
      signal,
    });

    if (response.status < 300 || response.status >= 400) {
      return { response, requestedUrl, finalUrl: currentUrl, redirects };
    }

    const location = response.headers.get("location");
    if (!location) {
      return { response, requestedUrl, finalUrl: currentUrl, redirects };
    }

    // Discard the redirect body so the connection can be reused.
    await response.body?.cancel().catch(() => {});

    const nextUrl = new URL(location, currentUrl).toString();
    currentUrl = await assertEgressAllowed(nextUrl);
    redirects.push(currentUrl);
  }

  throw new EgressBlockedError(`Too many redirects (limit ${maxRedirects}).`);
}

/** Reads a response body as text, capped to `maxBytes` to bound memory. */
export async function readTextCapped(response: Response, maxBytes = 2_000_000): Promise<string> {
  const buffer = await response.arrayBuffer();
  const decoder = new TextDecoder("utf-8");
  return decoder.decode(buffer.slice(0, maxBytes));
}