/**
 * Platform Runtime — Errors (Phase 5)
 *
 * A single error type the gateway maps onto HTTP status codes so route handlers
 * never have to guess.
 */

import type { PlatformErrorOptions } from "./types.ts";

export class PlatformError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly retryAfterMs?: number;

  constructor(options: PlatformErrorOptions) {
    super(options.code);
    this.name = "PlatformError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.retryAfterMs = options.retryAfterMs;
  }
}

export const badRequest = (message: string, details?: unknown): PlatformError =>
  new PlatformError({ status: 400, code: "bad_request", details: details ?? message });

export const unauthorized = (message = "authentication required"): PlatformError =>
  new PlatformError({ status: 401, code: "unauthorized", details: message });

export const forbidden = (message = "insufficient permissions"): PlatformError =>
  new PlatformError({ status: 403, code: "forbidden", details: message });

export const notFound = (message = "resource not found"): PlatformError =>
  new PlatformError({ status: 404, code: "not_found", details: message });

export const conflict = (message: string): PlatformError =>
  new PlatformError({ status: 409, code: "conflict", details: message });

export const tooManyRequests = (retryAfterMs: number): PlatformError =>
  new PlatformError({
    status: 429,
    code: "rate_limited",
    details: "rate limit exceeded",
    retryAfterMs,
  });