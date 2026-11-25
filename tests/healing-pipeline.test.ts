import { describe, it, expect } from "vitest";
import type { AuditIssue, AuditReport } from "../rules/types.ts";
import type { ConnectorMutation, CmsConnector, FetchLike } from "../cms/types.ts";
import {
  DEFAULT_AUTOPILOT_POLICY,
  buildExpectations,
  createApprovalQueue,
  createHealingEventBus,
  createRollbackStore,
  createScanScheduler,
  cronFieldMatches,
  evaluateApproval,
  isRiskWithin,
  lintJsonLdNode,
  lintJsonLdScripts,
  matchesCron,
  maxRisk,
  riskTierForField,
  runHealingPipeline,
  selectAutoDeployableMutations,
  triageIssue,
  triagePatch,
  verifyDeployment,
} from "../healing/index.ts";

const NOW = "2026-03-01T12:00:00.000Z";
const TARGET_URL = "https://example.com/blog/widgets";

/* --------------------------------------------------------------- fixtures -- */

function makeIssue(overrides: Partial<AuditIssue> & Pick<AuditIssue, "issueId">): AuditIssue {
  return {
    category: "metadata",
    severity: "medium",
    fixable: true,
    cmsTargetField: null,
    context: { currentValue: "", selector: "head", recommendedAction: "fix it" },
    ...overrides,
  };
}

function makeReport(issues: AuditIssue[]): AuditReport {
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const issue of issues) {
    bySeverity[issue.severity] += 1;
  }
  return {
    auditId: "aud_healing_1",
    domain: "example.com",
    pageUrl: TARGET_URL,
    timestamp: NOW,
    mode: "universal",
    modeDetection: { mode: "universal", confidence: 0.9, signals: [], overridden: false },
    issues,
    summary: { totalIssues: issues.length, bySeverity, byCategory: {}, score: 70 },
  };
}

const META_ISSUE = makeIssue({
  issueId: "iss_meta_desc_missing",
  cmsTargetField: "meta_description",
  context: { currentValue: "", selector: 'meta[name="description"]', recommendedAction: "add a description" },
});

const CANONICAL_ISSUE = makeIssue({
  issueId: "iss_canonical_missing",
  category: "technical",
  severity: "high",
  cmsTargetField: "canonical_url",
  context: { currentValue: null, selector: 'link[rel="canonical"]', recommendedAction: "add canonical" },
});

const SCHEMA_ISSUE = makeIssue({
  issueId: "iss_structured_data_missing",
  category: "schema",
  severity: "medium",
  cmsTargetField: "json_ld_schema",
  context: { currentValue: null, selector: "head", recommendedAction: "add JSON-LD" },
});

/* ------------------------------------------------------ fake CMS connector -- */

interface FakeState {
  applied: ConnectorMutation[];
  applyCalls: number;
  restored: boolean;
  restoredWith: Record<string, unknown> | null;
}

function createFakeConnector(overrides: Partial<CmsConnector> = {}): {
  connector: CmsConnector;
  state: FakeState;
} {
  const state: FakeState = { applied: [], applyCalls: 0, restored: false, restoredWith: null };
  const connector: CmsConnector = {
    platform: "wordpress",
    target: { url: TARGET_URL, resourceId: "42", resourceType: "posts" },
    async readSnapshot() {
      return { title: "Old title", meta_description: "Old description" };
    },
    async applyMutations(mutations) {
      state.applyCalls += 1;
      state.applied = mutations;
      return { ok: true, applied: mutations.length, errors: [] };
    },
    async verify() {
      return { ok: true, status: 200 };
    },
    async restore(snapshot) {
      state.restored = true;
      state.restoredWith = snapshot;
    },
    ...overrides,
  };
  return { connector, state };
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** A live page that reflects whatever the connector actually wrote. */
function reflectingFetch(state: FakeState): FetchLike {
  return async () => {
    const meta = state.applied.find((m) => m.field === "meta_description");
    const schema = state.applied.find((m) => m.field === "json_ld_schema");
    const parts = ["<!doctype html><html><head><title>Live</title>"];
    if (meta && typeof meta.after === "string") {
      parts.push(`<meta name="description" content="${escapeAttr(meta.after)}">`);
    }
    if (schema && schema.after) {
      parts.push(`<script type="application/ld+json">${JSON.stringify(schema.after)}</script>`);
    }
    parts.push("</head><body><h1>Live</h1></body></html>");
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => parts.join(""),
    } as unknown as Response;
  };
}

/* ---------------------------------------------------------------- triage -- */

describe("Phase 4 — Issue triage", () => {
  it("maps CMS fields to the roadmap risk tiers", () => {
    expect(riskTierForField("image_alt_text")).toBe("low");
    expect(riskTierForField("meta_description")).toBe("low");
    expect(riskTierForField("json_ld_schema")).toBe("low");
    expect(riskTierForField("title")).toBe("medium");
    expect(riskTierForField("h1")).toBe("medium");
    expect(riskTierForField("canonical_url")).toBe("high");
    expect(riskTierForField("body_content")).toBe("high");
    expect(riskTierForField("totally_unknown")).toBe("high");
    expect(riskTierForField(null)).toBe("high");
  });

  it("orders risk tiers and respects ceilings", () => {
    expect(maxRisk("low", "high")).toBe("high");
    expect(maxRisk("medium", "low")).toBe("medium");
    expect(isRiskWithin("low", "medium")).toBe(true);
    expect(isRiskWithin("high", "medium")).toBe(false);
  });

  it("classifies issues and marks only low-risk fixable ones auto-applicable", () => {
    expect(triageIssue(META_ISSUE)).toMatchObject({ risk: "low", autoApplicable: true });
    expect(triageIssue(CANONICAL_ISSUE)).toMatchObject({ risk: "high", autoApplicable: false });

    const unfixable = makeIssue({ issueId: "iss_noindex", fixable: false });
    expect(triageIssue(unfixable)).toMatchObject({ risk: "high", autoApplicable: false });

    const categoryOnly = makeIssue({ issueId: "iss_thin_content", category: "content", cmsTargetField: null });
    expect(triageIssue(categoryOnly).risk).toBe("high");
  });

  it("triages a patch and keeps the most conservative tier per mutation", () => {
    const report = makeReport([META_ISSUE, CANONICAL_ISSUE, SCHEMA_ISSUE]);
    const patch = {
      patchId: "ptch_1",
      auditId: report.auditId,
      targetUrl: TARGET_URL,
      mode: "universal" as const,
      createdAt: NOW,
      mutations: [
        { field: "meta_description", action: "replace" as const, before: null, after: "New", risk: "low" as const, autoApply: false },
        { field: "canonical_url", action: "replace" as const, before: null, after: TARGET_URL, risk: "medium" as const, autoApply: false },
      ],
    };
    const triage = triagePatch(patch, report.issues);
    expect(triage.mutations[0]).toMatchObject({ field: "meta_description", risk: "low" });
    // canonical is escalated to "high" by the roadmap field table even though the model said medium.
    expect(triage.mutations[1]).toMatchObject({ field: "canonical_url", risk: "high" });
    expect(triage.overallRisk).toBe("high");
    // The canonical escalation makes the patch ineligible for silent auto-deploy.
    expect(triage.autoDeployable).toBe(false);
    expect(triage.requiresApproval).toBe(true);
    expect(triage.issues).toHaveLength(3);
  });

  it("marks an all-low-risk patch auto-deployable", () => {
    const patch = {
      patchId: "ptch_2",
      auditId: "a",
      targetUrl: TARGET_URL,
      mode: "universal" as const,
      createdAt: NOW,
      mutations: [
        { field: "meta_description", action: "replace" as const, before: null, after: "New", risk: "low" as const, autoApply: false },
        { field: "image_alt_text", action: "replace" as const, before: null, after: "Alt", risk: "low" as const, autoApply: false },
      ],
    };
    const triage = triagePatch(patch);
    expect(triage.autoDeployable).toBe(true);
    expect(triage.requiresApproval).toBe(false);
  });
});

/* -------------------------------------------------------------- approval -- */

describe("Phase 4 — Approval gate & auto-pilot", () => {
  const patch = {
    patchId: "ptch_ap",
    auditId: "a",
    targetUrl: TARGET_URL,
    mode: "universal" as const,
    createdAt: NOW,
    mutations: [
      { field: "meta_description", action: "replace" as const, before: null, after: "New", risk: "low" as const, autoApply: false },
      { field: "canonical_url", action: "replace" as const, before: null, after: TARGET_URL, risk: "medium" as const, autoApply: false },
      { field: "meta_robots", action: "manual_review" as const, before: null, after: null, risk: "high" as const, autoApply: false },
    ],
  };
  const triage = triagePatch(patch);

  it("queues everything while auto-pilot is disabled", () => {
    const decision = evaluateApproval(triage, DEFAULT_AUTOPILOT_POLICY);
    expect(decision.status).toBe("pending");
    expect(selectAutoDeployableMutations(patch, triage, DEFAULT_AUTOPILOT_POLICY)).toHaveLength(0);
  });

  it("auto-approves only mutations at or below the ceiling", () => {
    const policy = { enabled: true, maxRisk: "low" as const };
    expect(evaluateApproval(triage, policy).status).toBe("auto_approved");
    const selected = selectAutoDeployableMutations(patch, triage, policy);
    expect(selected.map((m) => m.field)).toEqual(["meta_description"]);
  });

  it("approves more as the ceiling rises, but never manual_review", () => {
    const policy = { enabled: true, maxRisk: "high" as const };
    const selected = selectAutoDeployableMutations(patch, triage, policy);
    expect(selected.map((m) => m.field)).toEqual(["meta_description", "canonical_url"]);
  });

  it("lets an operator approve or reject a queued request", () => {
    const queue = createApprovalQueue();
    const request = queue.submit({ patch, triage, now: NOW });
    expect(request.status).toBe("pending");
    expect(queue.pending()).toHaveLength(1);
    const approved = queue.decide(request.id, "approved", "Looks good", NOW);
    expect(approved?.status).toBe("approved");
    expect(approved?.note).toBe("Looks good");
    expect(queue.pending()).toHaveLength(0);
    expect(queue.decide("missing", "approved")).toBeNull();
  });

  it("records auto-approvals in the queue with their diff", () => {
    const queue = createApprovalQueue();
    const request = queue.submit({ patch, triage, policy: { enabled: true, maxRisk: "low" }, now: NOW });
    expect(request.status).toBe("auto_approved");
    expect(request.diff).toHaveLength(3);
    expect(request.decidedAt).toBe(NOW);
  });
});

/* ---------------------------------------------------------- rollback store -- */

describe("Phase 4 — Versioned rollback store", () => {
  it("assigns monotonically increasing versions per target", () => {
    const store = createRollbackStore();
    const first = store.record({ patchId: "p1", targetUrl: TARGET_URL, platform: "wordpress", snapshot: { title: "A" }, now: NOW });
    const second = store.record({ patchId: "p2", targetUrl: TARGET_URL, platform: "wordpress", snapshot: { title: "B" }, now: NOW });
    const otherTarget = store.record({ patchId: "p3", targetUrl: "https://example.com/other", platform: "shopify", snapshot: {}, now: NOW });

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(otherTarget.version).toBe(1);
    expect(store.latest(TARGET_URL)?.id).toBe(second.id);
    expect(store.history(TARGET_URL)).toHaveLength(2);
    expect(store.get(first.id)?.snapshot).toEqual({ title: "A" });
    expect(store.size()).toBe(3);
    expect(store.latest("https://nope")).toBeNull();
  });
});

/* ---------------------------------------------------------- JSON-LD linter -- */

describe("Phase 4 — JSON-LD linter", () => {
  it("passes a well-formed Organization node", () => {
    const result = lintJsonLdNode({ "@context": "https://schema.org", "@type": "Organization", name: "Example" });
    expect(result.valid).toBe(true);
    expect(result.types).toContain("Organization");
  });

  it("flags missing required and missing @type", () => {
    const missing = lintJsonLdNode({ "@type": "Product", name: "Widget" });
    expect(missing.valid).toBe(false);
    expect(missing.issues.map((i) => i.message).join(" ")).toMatch(/offers/);

    const typed = lintJsonLdNode({ name: "Untyped" });
    expect(typed.valid).toBe(false);
    expect(typed.issues.some((i) => /@type/.test(i.message))).toBe(true);
  });

  it("recurses into nested typed nodes and handles arrays/@graph", () => {
    const product = lintJsonLdNode({
      "@type": "Product",
      name: "Widget",
      offers: { "@type": "Offer", price: "9.99" },
    });
    expect(product.valid).toBe(true);

    const scripts = lintJsonLdScripts([{ "@type": "Organization", name: "Example" }]);
    expect(scripts.valid).toBe(true);
    expect(scripts.nodeCount).toBe(1);

    const none = lintJsonLdScripts([]);
    expect(none.valid).toBe(false);
    expect(none.issues[0]?.message).toMatch(/no JSON-LD/);
  });
});

/* ------------------------------------------------------------ micro-crawler -- */

describe("Phase 4 — Post-fix micro-crawler", () => {
  it("only asserts expectations it can read back from the DOM", () => {
    const { expectations, expectJsonLd } = buildExpectations([
      { field: "meta_description", action: "replace", before: null, after: "New desc", risk: "low", autoApply: true },
      { field: "image_alt_text", action: "replace", before: null, after: "Alt", risk: "low", autoApply: true },
      { field: "json_ld_schema", action: "inject", before: null, after: { "@type": "Organization" }, risk: "low", autoApply: true },
      { field: "meta_robots", action: "manual_review", before: null, after: null, risk: "high", autoApply: false },
    ]);
    expect(expectations.map((e) => e.field)).toEqual(["meta_description"]);
    expect(expectJsonLd).toBe(true);
  });

  it("passes when the live DOM matches and JSON-LD is valid", async () => {
    const html =
      '<html><head><title>Widgets | Example</title>' +
      '<meta name="description" content="Fresh description">' +
      '<link rel="canonical" href="https://example.com/blog/widgets">' +
      '<script type="application/ld+json">{"@type":"Organization","name":"Example"}</script>' +
      "</head><body></body></html>";
    const report = await verifyDeployment({
      url: TARGET_URL,
      expectations: [
        { field: "title", expected: "Widgets | Example" },
        { field: "meta_description", expected: "Fresh description" },
        { field: "canonical_url", expected: "https://example.com/blog/widgets" },
      ],
      expectJsonLd: true,
      fetchImpl: async () => ({ ok: true, status: 200, text: async () => html }) as unknown as Response,
      now: () => NOW,
    });
    expect(report.httpOk).toBe(true);
    expect(report.domMatches).toBe(true);
    expect(report.jsonLdValid).toBe(true);
    expect(report.checks.every((c) => c.passed)).toBe(true);
    expect(report.errors).toEqual([]);
  });

  it("fails on a DOM mismatch, a bad status and a network error", async () => {
    const mismatch = await verifyDeployment({
      url: TARGET_URL,
      expectations: [{ field: "title", expected: "Expected" }],
      fetchImpl: async () => ({ ok: true, status: 200, text: async () => "<title>Different</title>" }) as unknown as Response,
      now: () => NOW,
    });
    expect(mismatch.domMatches).toBe(false);
    expect(mismatch.errors[0]).toMatch(/title/);

    const badStatus = await verifyDeployment({
      url: TARGET_URL,
      expectations: [],
      fetchImpl: async () => ({ ok: false, status: 503, text: async () => "" }) as unknown as Response,
      now: () => NOW,
    });
    expect(badStatus.httpOk).toBe(false);
    expect(badStatus.errors[0]).toMatch(/HTTP 503/);

    const network = await verifyDeployment({
      url: TARGET_URL,
      expectations: [],
      fetchImpl: async () => {
        throw new Error("connection reset");
      },
      now: () => NOW,
    });
    expect(network.httpOk).toBe(false);
    expect(network.errors[0]).toMatch(/connection reset/);
  });
});

/* ------------------------------------------------------------------ events -- */

describe("Phase 4 — Healing event log", () => {
  it("emits, filters and streams pipeline events", () => {
    const bus = createHealingEventBus(() => NOW);
    const seen: string[] = [];
    const unsubscribe = bus.subscribe((event) => seen.push(event.type));

    bus.emit({ type: "scan_started", message: "scan" });
    bus.emit({ type: "rolled_back", message: "broke" });
    bus.emit({ type: "alert", message: "help", level: "error" });

    expect(bus.all()).toHaveLength(3);
    expect(bus.byType("alert")).toHaveLength(1);
    expect(bus.alerts().map((e) => e.type)).toEqual(["rolled_back", "alert"]);
    expect(seen).toEqual(["scan_started", "rolled_back", "alert"]);
    expect(bus.all()[0]).toMatchObject({ level: "info", at: NOW });
    expect(bus.all()[1]?.level).toBe("warning");

    unsubscribe();
    bus.emit({ type: "scan_started", message: "again" });
    expect(seen).toHaveLength(3);
  });
});

/* --------------------------------------------------------------- scheduler -- */

describe("Phase 4 — Continuous scan scheduler", () => {
  it("matches cron fields including ranges, lists and steps", () => {
    expect(cronFieldMatches("*", 0, 59, 30)).toBe(true);
    expect(cronFieldMatches("*/15", 0, 59, 30)).toBe(true);
    expect(cronFieldMatches("*/15", 0, 59, 31)).toBe(false);
    expect(cronFieldMatches("1,15,30", 0, 59, 15)).toBe(true);
    expect(cronFieldMatches("10-20", 0, 59, 18)).toBe(true);
    expect(cronFieldMatches("10-20", 0, 59, 25)).toBe(false);

    const date = new Date("2026-03-01T09:30:00");
    expect(matchesCron("30 9 * * *", date)).toBe(true);
    expect(matchesCron("0 9 * * *", date)).toBe(false);
    expect(() => matchesCron("bad", date)).toThrow(/5 fields/);
  });

  it("materializes due cron jobs once per minute and drains the queue", () => {
    const scheduler = createScanScheduler();
    const schedule = scheduler.register({ targetUrl: TARGET_URL, cron: "*/5 * * * *" });
    expect(scheduler.list()).toHaveLength(1);

    const at = new Date("2026-03-01T09:30:00");
    const first = scheduler.takeDue(at);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ targetUrl: TARGET_URL, trigger: "cron", scheduleId: schedule.id });

    // Same minute → no duplicate.
    expect(scheduler.takeDue(new Date("2026-03-01T09:30:30"))).toHaveLength(1);

    // Still queued until drained.
    expect(scheduler.queued()).toHaveLength(1);
    expect(scheduler.drain()).toHaveLength(1);
    expect(scheduler.queued()).toHaveLength(0);
  });

  it("handles webhook and manual triggers and honours enable/disable", () => {
    const scheduler = createScanScheduler();
    const schedule = scheduler.register({ targetUrl: TARGET_URL, cron: "0 0 * * *" });
    expect(scheduler.setEnabled(schedule.id, false)?.enabled).toBe(false);
    expect(scheduler.takeDue(new Date("2026-03-01T00:00:00"))).toHaveLength(0);

    scheduler.onCmsPublish({ targetUrl: TARGET_URL });
    scheduler.manual(TARGET_URL);
    const drained = scheduler.drain();
    expect(drained.map((j) => j.trigger)).toEqual(["webhook", "manual"]);
    expect(scheduler.setEnabled("nope", true)).toBeNull();
    expect(() => scheduler.register({ targetUrl: TARGET_URL, cron: "bad" })).toThrow();
  });
});

/* ---------------------------------------------------------------- pipeline -- */

describe("Phase 4 — Self-healing pipeline", () => {
  it("queues a patch for approval when auto-pilot is disabled (no CMS write)", async () => {
    const { connector, state } = createFakeConnector();
    const queue = createApprovalQueue();
    const result = await runHealingPipeline({
      report: makeReport([META_ISSUE]),
      connector,
      queue,
      now: () => NOW,
    });
    expect(result.status).toBe("queued");
    expect(result.approval.status).toBe("pending");
    expect(result.deployment?.status).toBe("queued");
    expect(result.snapshotId).toBeNull();
    expect(state.applyCalls).toBe(0);
    expect(queue.pending()).toHaveLength(1);
    expect(result.events.map((e) => e.type)).toContain("awaiting_approval");
  });

  it("deploys then verifies a low-risk fix under auto-pilot", async () => {
    const { connector, state } = createFakeConnector();
    const result = await runHealingPipeline({
      report: makeReport([META_ISSUE]),
      connector,
      policy: { enabled: true, maxRisk: "low" },
      fetchImpl: reflectingFetch(state),
      now: () => NOW,
    });
    expect(result.approval.status).toBe("auto_approved");
    expect(result.status).toBe("deployed");
    expect(result.deployment?.applied).toBe(1);
    expect(state.applied.map((m) => m.field)).toEqual(["meta_description"]);
    expect(result.verification?.httpOk).toBe(true);
    expect(result.verification?.domMatches).toBe(true);
    expect(result.snapshotId).toBeTruthy();
    const types = result.events.map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(["scan_started", "patch_synthesized", "auto_approved", "deployment_started", "verified", "deployed"]));
  });

  it("verifies injected JSON-LD against the linter", async () => {
    const { connector, state } = createFakeConnector();
    const result = await runHealingPipeline({
      report: makeReport([SCHEMA_ISSUE]),
      connector,
      policy: { enabled: true, maxRisk: "medium" },
      fetchImpl: reflectingFetch(state),
      now: () => NOW,
    });
    expect(result.status).toBe("deployed");
    expect(result.verification?.jsonLdValid).toBe(true);
    expect(result.verification?.jsonLd?.types).toContain("Organization");
  });

  it("rolls back when the live DOM no longer matches", async () => {
    const { connector, state } = createFakeConnector();
    const result = await runHealingPipeline({
      report: makeReport([META_ISSUE]),
      connector,
      policy: { enabled: true, maxRisk: "low" },
      // A stale cache serves the old page: no meta description → verification fails.
      fetchImpl: async () => ({ ok: true, status: 200, text: async () => "<title>Old</title>" }) as unknown as Response,
      now: () => NOW,
    });
    expect(result.status).toBe("rolled_back");
    expect(result.deployment?.rolledBack).toBe(true);
    expect(state.restored).toBe(true);
    expect(state.restoredWith).toMatchObject({ title: "Old title" });
    expect(result.events.map((e) => e.type)).toEqual(expect.arrayContaining(["rolled_back", "alert"]));
  });

  it("rolls back when the CMS rejects the write", async () => {
    const { connector, state } = createFakeConnector({
      async applyMutations() {
        return { ok: false, applied: 0, errors: ["CMS rejected write"] };
      },
    });
    const result = await runHealingPipeline({
      report: makeReport([META_ISSUE]),
      connector,
      policy: { enabled: true, maxRisk: "low" },
      fetchImpl: async () => ({ ok: true, status: 200, text: async () => "" }) as unknown as Response,
      now: () => NOW,
    });
    expect(result.status).toBe("rolled_back");
    expect(result.deployment?.errors.join(" ")).toMatch(/rejected/);
    expect(state.restored).toBe(true);
  });

  it("fails early when the pre-change snapshot cannot be read", async () => {
    const { connector } = createFakeConnector({
      async readSnapshot() {
        throw new Error("auth expired");
      },
    });
    const result = await runHealingPipeline({
      report: makeReport([META_ISSUE]),
      connector,
      policy: { enabled: true, maxRisk: "low" },
      now: () => NOW,
    });
    expect(result.status).toBe("failed");
    expect(result.snapshotId).toBeNull();
    expect(result.deployment?.errors.join(" ")).toMatch(/auth expired/);
    expect(result.events.some((e) => e.type === "alert")).toBe(true);
  });

  it("uses the injected event bus and rollback store", async () => {
    const { connector, state } = createFakeConnector();
    const events = createHealingEventBus(() => NOW);
    const rollbackStore = createRollbackStore();
    await runHealingPipeline({
      report: makeReport([META_ISSUE]),
      connector,
      policy: { enabled: true, maxRisk: "low" },
      events,
      rollbackStore,
      fetchImpl: reflectingFetch(state),
      now: () => NOW,
    });
    expect(events.byType("deployed")).toHaveLength(1);
    expect(rollbackStore.history(TARGET_URL)).toHaveLength(1);
    expect(rollbackStore.latest(TARGET_URL)?.patchId).toBeTruthy();
  });
});
