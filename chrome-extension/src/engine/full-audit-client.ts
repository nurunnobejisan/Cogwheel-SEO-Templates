/**
 * Client for the deployed SEO Studio `/api/full-audit` endpoint.
 *
 * The extension never synthesises audit numbers. Every score shown in a batch
 * row is measured by the rules engine on the server; a failed, cancelled or
 * malformed run yields `null` fields so the UI prints "unavailable" instead of
 * a guess. Nothing here invents a score, a grade or a word count.
 */

/** Production API origin used by the extension (see GeoVisibilityCard). */
export const FULL_AUDIT_API_BASE = "https://seo-studio-one.vercel.app";
export const FULL_AUDIT_ENDPOINT = `${FULL_AUDIT_API_BASE}/api/full-audit`;

/** Parallel audits per batch run. Low on purpose: one run must not monopolise the API. */
export const BATCH_AUDIT_CONCURRENCY = 3;

export interface BatchAuditMeasurement {
  /** Weighted 0-100 composite from the rules engine. */
  overall: number;
  onPage: number;
  schema: number;
  /** On-page GEO heuristic (labelled "estimated" by the report's provenance). */
  geo: number;
  h1: string;
  /** null when the report did not carry a word count. */
  wordCount: number | null;
  /** null when the report did not carry a schema list. */
  schemasFound: number | null;
  /** Which report sections were measured / estimated / unavailable. */
  provenance: {
    measured: string[];
    estimated: string[];
    unavailable: string[];
  };
}

export type BatchAuditOutcome =
  | { ok: true; measurement: BatchAuditMeasurement }
  | { ok: false; reason: string };

export type BatchGrade = "A+ OPTIMAL" | "A STRONG" | "B NEEDS AUDIT" | "C CRITICAL";

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/**
 * Shape-validate an `/api/full-audit` response. Anything unexpected becomes
 * `{ ok: false }` — never a partial or defaulted score.
 */
export function parseFullAuditPayload(payload: unknown): BatchAuditOutcome {
  const root = asRecord(payload);
  if (!root) return { ok: false, reason: "Audit response was not an object" };

  const report = asRecord(root.report);
  if (root.success !== true || !report) {
    const reason = typeof root.error === "string" && root.error ? root.error : "Audit response contained no report";
    return { ok: false, reason };
  }

  const scores = asRecord(report.scores);
  const overall = finiteNumber(report.overallScore);
  const onPage = finiteNumber(scores?.onPage);
  const schema = finiteNumber(scores?.schema);
  const geo = finiteNumber(scores?.aiVisibility);
  if (overall === null || onPage === null || schema === null || geo === null) {
    return { ok: false, reason: "Audit response was missing scores" };
  }

  const onPageSection = asRecord(report.onPage);
  const headings = asRecord(report.headings);
  const schemaValidation = asRecord(report.schemaValidation);
  const provenance = asRecord(report.dataProvenance);

  const detected = schemaValidation?.schemasDetected;
  const schemasDetected = Array.isArray(detected) ? detected.length : null;

  return {
    ok: true,
    measurement: {
      overall,
      onPage,
      schema,
      geo,
      h1: typeof headings?.sampleH1 === "string" ? headings.sampleH1 : "",
      wordCount: finiteNumber(onPageSection?.wordCount),
      schemasFound: schemasDetected,
      provenance: {
        measured: stringList(provenance?.measured),
        estimated: stringList(provenance?.estimated),
        unavailable: stringList(provenance?.unavailable),
      },
    },
  };
}

export interface RunFullAuditOptions {
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
  endpoint?: string;
}

/** POST one URL at the audit endpoint. Never throws: failures come back as `{ ok: false }`. */
export async function runFullAudit(
  targetUrl: string,
  options: RunFullAuditOptions = {},
): Promise<BatchAuditOutcome> {
  const fetchFn = options.fetchFn ?? fetch;
  try {
    const res = await fetchFn(options.endpoint ?? FULL_AUDIT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUrl }),
      signal: options.signal,
    });
    if (!res.ok) return { ok: false, reason: `Audit request failed (HTTP ${res.status})` };
    return parseFullAuditPayload(await res.json());
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, reason: "Audit cancelled" };
    }
    return { ok: false, reason: err instanceof Error ? err.message : "Audit request failed" };
  }
}

/**
 * Run `worker` over `items` with at most `limit` in flight. Results keep input
 * order, so index N in the output always corresponds to input N.
 */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const width = Math.max(1, Math.min(Math.floor(limit), items.length || 1));
  const runners = Array.from({ length: width }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index] as T, index);
    }
  });
  await Promise.all(runners);
  return results;
}

/** Grade from a measured overall score. null when there is no score to grade. */
export function gradeForOverall(overall: number | null): BatchGrade | null {
  if (overall === null) return null;
  if (overall >= 92) return "A+ OPTIMAL";
  if (overall >= 85) return "A STRONG";
  if (overall >= 75) return "B NEEDS AUDIT";
  return "C CRITICAL";
}
