import { describe, expect, it } from "vitest";
import {
  BATCH_AUDIT_CONCURRENCY,
  FULL_AUDIT_ENDPOINT,
  gradeForOverall,
  parseFullAuditPayload,
  runFullAudit,
  runWithConcurrency,
} from "../chrome-extension/src/engine/full-audit-client";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    report: {
      overallScore: 84,
      scores: { technical: 90, onPage: 81, headings: 88, images: 70, schema: 65, gsc: 0, aiVisibility: 72 },
      onPage: { wordCount: 612 },
      headings: { sampleH1: "Oceanfront Suites in Panama City Beach" },
      schemaValidation: { schemasDetected: ["Hotel", "BreadcrumbList"] },
      dataProvenance: {
        measured: ["onPage (title, meta description, word count, viewport)"],
        estimated: ["aiGeoVisibility.visibilityScore (documented on-page heuristic)"],
        unavailable: ["searchConsole (Google Search Console not connected)"],
        simulated: false,
        notes: [],
      },
      ...overrides,
    },
  };
}

describe("parseFullAuditPayload", () => {
  it("maps a real audit report onto batch measurements", () => {
    const outcome = parseFullAuditPayload(validPayload());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.measurement).toEqual({
      overall: 84,
      onPage: 81,
      schema: 65,
      geo: 72,
      h1: "Oceanfront Suites in Panama City Beach",
      wordCount: 612,
      schemasFound: 2,
      provenance: {
        measured: ["onPage (title, meta description, word count, viewport)"],
        estimated: ["aiGeoVisibility.visibilityScore (documented on-page heuristic)"],
        unavailable: ["searchConsole (Google Search Console not connected)"],
      },
    });
  });

  it("keeps optional fields null instead of defaulting them to zero", () => {
    const payload = validPayload();
    delete (payload.report as Record<string, unknown>).onPage;
    delete (payload.report as Record<string, unknown>).schemaValidation;
    const outcome = parseFullAuditPayload(payload);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.measurement.wordCount).toBeNull();
    expect(outcome.measurement.schemasFound).toBeNull();
  });

  it("rejects a response whose scores are missing rather than inventing numbers", () => {
    const payload = validPayload();
    delete (payload.report as Record<string, unknown>).scores;
    const outcome = parseFullAuditPayload(payload);
    expect(outcome).toEqual({ ok: false, reason: "Audit response was missing scores" });
  });

  it("surfaces the server error message when the audit failed", () => {
    expect(parseFullAuditPayload({ success: false, error: "Target URL is required" })).toEqual({
      ok: false,
      reason: "Target URL is required",
    });
  });

  it("rejects non-object payloads", () => {
    expect(parseFullAuditPayload(null).ok).toBe(false);
    expect(parseFullAuditPayload("nope").ok).toBe(false);
    expect(parseFullAuditPayload({ success: true }).ok).toBe(false);
  });

  it("drops non-string provenance entries instead of trusting them", () => {
    const payload = validPayload();
    (payload.report.dataProvenance as Record<string, unknown>).measured = ["onPage", 42, null];
    const outcome = parseFullAuditPayload(payload);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.measurement.provenance.measured).toEqual(["onPage"]);
  });
});

describe("runFullAudit", () => {
  it("POSTs the target URL to the deployed audit endpoint", async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = [];
    const impl = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      seen.push({ url: String(url), init });
      return new Response(JSON.stringify(validPayload()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const fetchFn = impl as unknown as typeof fetch;

    const outcome = await runFullAudit("https://example.com/hotel", { fetchFn });
    expect(outcome.ok).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toBe(FULL_AUDIT_ENDPOINT);
    expect(seen[0]!.init?.method).toBe("POST");
    expect(String(seen[0]!.init?.body)).toBe(JSON.stringify({ targetUrl: "https://example.com/hotel" }));
  });

  it("reports HTTP failures as unavailable instead of a zero score", async () => {
    const impl = async (): Promise<Response> => new Response("boom", { status: 500 });
    const outcome = await runFullAudit("https://example.com", { fetchFn: impl as unknown as typeof fetch });
    expect(outcome).toEqual({ ok: false, reason: "Audit request failed (HTTP 500)" });
  });

  it("labels an aborted request as cancelled", async () => {
    const impl = async (): Promise<Response> => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    };
    const outcome = await runFullAudit("https://example.com", { fetchFn: impl as unknown as typeof fetch });
    expect(outcome).toEqual({ ok: false, reason: "Audit cancelled" });
  });

  it("turns network errors into a reason the UI can display", async () => {
    const impl = async (): Promise<Response> => {
      throw new TypeError("Failed to fetch");
    };
    const outcome = await runFullAudit("https://example.com", { fetchFn: impl as unknown as typeof fetch });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("Failed to fetch");
  });
});

describe("runWithConcurrency", () => {
  it("never runs more than the configured number of jobs at once", async () => {
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);

    const results = await runWithConcurrency(items, BATCH_AUDIT_CONCURRENCY, async (item) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 2));
      inFlight--;
      return item * 2;
    });

    expect(peak).toBeLessThanOrEqual(BATCH_AUDIT_CONCURRENCY);
    expect(peak).toBeGreaterThan(1);
    expect(results).toEqual(items.map((i) => i * 2));
  });

  it("keeps results aligned with input order", async () => {
    const items = ["a", "b", "c", "d", "e"];
    const results = await runWithConcurrency(items, 2, async (item, index) => {
      await new Promise((resolve) => setTimeout(resolve, (5 - index) % 3));
      return `${index}:${item}`;
    });
    expect(results).toEqual(items.map((item, index) => `${index}:${item}`));
  });

  it("handles an empty list", async () => {
    await expect(runWithConcurrency([], 3, async () => 1)).resolves.toEqual([]);
  });
});

describe("gradeForOverall", () => {
  it("grades measured scores only", () => {
    expect(gradeForOverall(100)).toBe("A+ OPTIMAL");
    expect(gradeForOverall(92)).toBe("A+ OPTIMAL");
    expect(gradeForOverall(91)).toBe("A STRONG");
    expect(gradeForOverall(85)).toBe("A STRONG");
    expect(gradeForOverall(84)).toBe("B NEEDS AUDIT");
    expect(gradeForOverall(75)).toBe("B NEEDS AUDIT");
    expect(gradeForOverall(74)).toBe("C CRITICAL");
    expect(gradeForOverall(0)).toBe("C CRITICAL");
  });

  it("returns null when there is no score — never a default grade", () => {
    expect(gradeForOverall(null)).toBeNull();
  });
});
