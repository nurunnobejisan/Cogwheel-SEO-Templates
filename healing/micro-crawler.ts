/**
 * Post-Fix Micro-Crawler Verification (Phase 4, step 5)
 *
 * Within seconds of deployment, fetch the live public URL and confirm the fix
 * actually landed:
 *   - HTTP 200 response status,
 *   - the target DOM values match the approved patch,
 *   - injected JSON-LD parses and passes the structured-data linter.
 */

import { buildSnapshotFromHtml } from "../rules/html-snapshot.ts";
import type { PageSnapshot } from "../rules/types.ts";
import type { PatchMutation } from "../ai/types.ts";
import type { FetchLike } from "../cms/types.ts";
import { lintJsonLdScripts } from "./jsonld-linter.ts";
import type { VerificationCheck, VerificationExpectation, VerificationReport } from "./types.ts";

export interface BuildExpectationsResult {
  expectations: VerificationExpectation[];
  expectJsonLd: boolean;
}

/** Fields the micro-crawler can compare against the live DOM. */
export const VERIFIABLE_FIELDS = new Set([
  "title",
  "meta_description",
  "canonical_url",
  "og_title",
  "og_description",
  "og_image",
  "twitter_card",
  "h1",
  "viewport_meta",
]);

/** Derive the live-DOM expectations from a patch's deployable mutations. */
export function buildExpectations(mutations: PatchMutation[]): BuildExpectationsResult {
  const expectations: VerificationExpectation[] = [];
  let expectJsonLd = false;

  for (const mutation of mutations) {
    if (mutation.action === "manual_review") {
      continue;
    }
    if (mutation.field === "json_ld_schema") {
      expectJsonLd = true;
      continue;
    }
    if (!VERIFIABLE_FIELDS.has(mutation.field)) {
      continue;
    }
    const expected = toExpectedString(mutation.after);
    if (expected !== null) {
      expectations.push({ field: mutation.field, expected });
    }
  }
  return { expectations, expectJsonLd };
}

function toExpectedString(value: PatchMutation["after"]): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === "string" ? value : JSON.stringify(value);
}

function normalize(value: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/** Extract the live value a field maps to from a parsed page snapshot. */
export function actualValueForField(snapshot: PageSnapshot, field: string): string | null {
  switch (field) {
    case "title":
      return snapshot.title || null;
    case "meta_description":
      return snapshot.metaDescription || null;
    case "canonical_url":
      return snapshot.canonical;
    case "og_title":
      return snapshot.openGraph.title ?? null;
    case "og_description":
      return snapshot.openGraph.description ?? null;
    case "og_image":
      return snapshot.openGraph.image ?? null;
    case "twitter_card":
      return snapshot.twitter.card ?? null;
    case "h1": {
      const h1s = snapshot.headings.filter((heading) => heading.level === 1).map((heading) => heading.text);
      return h1s.length > 0 ? h1s.join(" | ") : null;
    }
    case "viewport_meta":
      return snapshot.hasViewport ? "present" : null;
    default:
      return null;
  }
}

export interface MicroCrawlOptions {
  url: string;
  expectations: VerificationExpectation[];
  expectJsonLd?: boolean;
  /** Require the JSON-LD linter to pass (default true when expectJsonLd). */
  requireJsonLdValid?: boolean;
  fetchImpl?: FetchLike;
  now?: () => string;
}

export async function verifyDeployment(options: MicroCrawlOptions): Promise<VerificationReport> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date().toISOString());
  const requireJsonLdValid = options.requireJsonLdValid ?? Boolean(options.expectJsonLd);
  const base = { url: options.url, verifiedAt: now() };

  let status: number | null = null;
  let html = "";
  try {
    const response = await fetchImpl(options.url, { headers: {} });
    status = response.status;
    if (!response.ok) {
      return {
        ...base,
        status,
        httpOk: false,
        domMatches: false,
        jsonLdValid: false,
        checks: [],
        jsonLd: null,
        errors: [`live page returned HTTP ${status}`],
      };
    }
    html = await response.text();
  } catch (error) {
    return {
      ...base,
      status,
      httpOk: false,
      domMatches: false,
      jsonLdValid: false,
      checks: [],
      jsonLd: null,
      errors: [`live fetch failed: ${error instanceof Error ? error.message : String(error)}`],
    };
  }

  const snapshot = buildSnapshotFromHtml(html, options.url);

  const checks: VerificationCheck[] = options.expectations.map((expectation) => {
    const actual = actualValueForField(snapshot, expectation.field);
    const passed = normalize(actual) === normalize(expectation.expected);
    return {
      field: expectation.field,
      passed,
      actual,
      detail: passed
        ? "live value matches the approved patch"
        : `expected "${normalize(expectation.expected)}" but found "${normalize(actual)}"`,
    };
  });

  const jsonLd = lintJsonLdScripts(snapshot.jsonLd);
  const domMatches = checks.every((check) => check.passed);
  const jsonLdValid = requireJsonLdValid ? jsonLd.valid : true;

  const errors: string[] = [];
  for (const check of checks) {
    if (!check.passed) {
      errors.push(`${check.field}: ${check.detail}`);
    }
  }
  if (requireJsonLdValid && !jsonLd.valid) {
    for (const issue of jsonLd.issues) {
      errors.push(`json-ld ${issue.path}: ${issue.message}`);
    }
  }

  return {
    ...base,
    status,
    httpOk: true,
    domMatches,
    jsonLdValid,
    checks,
    jsonLd,
    errors,
  };
}
